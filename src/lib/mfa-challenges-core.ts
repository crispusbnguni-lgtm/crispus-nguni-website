import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";

export const MFA_CHALLENGE_TTL_SECONDS = 5 * 60;
export const MFA_CHALLENGE_MAX_ATTEMPTS = 5;

export type MfaPrimaryAuthMethod =
  | "EMAIL"
  | "PHONE"
  | "GOOGLE"
  | "APPLE"
  | "PASSKEY";
export type MfaChallengePurpose = "LOGIN" | "STEP_UP" | "ENROLLMENT";

export type PendingMfaChallenge = {
  userId: string;
  primaryAuthMethod: MfaPrimaryAuthMethod;
  purpose: MfaChallengePurpose;
  primaryAuthenticationEventId: string;
  sessionId?: string;
  factorStateVersion?: string;
  expiresAt: number;
};

export type CreatedMfaChallenge = {
  token: string;
  expiresAt: number;
};

export type MfaChallengeStore = {
  set(
    key: string,
    value: string,
    options: { ex: number; nx: true },
  ): Promise<unknown>;
  get(key: string): Promise<unknown>;
  getdel(key: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  recordFailedAttempt(
    challengeKey: string,
    attemptsKey: string,
    ttlSeconds: number,
    maxAttempts: number,
  ): Promise<unknown>;
};

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const USER_ID_MAX_LENGTH = 255;
const STORAGE_KEY_PREFIX = "auth:mfa:pending:";
const ATTEMPT_KEY_PREFIX = "auth:mfa:attempts:";
const SAFE_CONTEXT_VALUE = /^[A-Za-z0-9_-]{1,255}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const trustedChallenges = new WeakSet<object>();

function isPrimaryAuthMethod(value: unknown): value is MfaPrimaryAuthMethod {
  return (
    value === "EMAIL" ||
    value === "PHONE" ||
    value === "GOOGLE" ||
    value === "APPLE" ||
    value === "PASSKEY"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeChallenge(value: unknown): PendingMfaChallenge | null {
  if (typeof value !== "string") return null;
  let record: unknown;
  try {
    record = JSON.parse(value) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(record)) return null;

  const expectedKeys = [
    "userId",
    "primaryAuthMethod",
    "purpose",
    "primaryAuthenticationEventId",
    "expiresAt",
  ];
  if (record.purpose === "STEP_UP") expectedKeys.push("sessionId");
  if (record.factorStateVersion !== undefined) expectedKeys.push("factorStateVersion");

  try {
    const keys = Reflect.ownKeys(record);
    if (
      keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key)) ||
      expectedKeys.some((key) => !Object.hasOwn(record, key))
    ) return null;

    for (const key of keys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
      if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) {
        return null;
      }
    }
  } catch {
    return null;
  }

  if (
    typeof record.userId !== "string" ||
    record.userId.length === 0 ||
    record.userId.length > USER_ID_MAX_LENGTH ||
    !isPrimaryAuthMethod(record.primaryAuthMethod) ||
    (record.purpose !== "LOGIN" && record.purpose !== "STEP_UP" && record.purpose !== "ENROLLMENT") ||
    typeof record.primaryAuthenticationEventId !== "string" ||
    !UUID_PATTERN.test(record.primaryAuthenticationEventId) ||
    (record.purpose === "STEP_UP" &&
      (typeof record.sessionId !== "string" || !SAFE_CONTEXT_VALUE.test(record.sessionId))) ||
    (record.purpose === "LOGIN" && record.sessionId !== undefined) ||
    (record.factorStateVersion !== undefined &&
      (typeof record.factorStateVersion !== "string" || !SAFE_CONTEXT_VALUE.test(record.factorStateVersion))) ||
    typeof record.expiresAt !== "number" ||
    !Number.isSafeInteger(record.expiresAt)
  ) return null;

  const challenge: PendingMfaChallenge = {
    userId: record.userId,
    primaryAuthMethod: record.primaryAuthMethod,
    purpose: record.purpose,
    primaryAuthenticationEventId: record.primaryAuthenticationEventId,
    ...(typeof record.sessionId === "string" ? { sessionId: record.sessionId } : {}),
    ...(typeof record.factorStateVersion === "string"
      ? { factorStateVersion: record.factorStateVersion }
      : {}),
    expiresAt: record.expiresAt,
  };
  trustedChallenges.add(challenge);
  return challenge;
}

function tokenDigest(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function tokenKey(token: string): string {
  return `${STORAGE_KEY_PREFIX}${tokenDigest(token)}`;
}

function attemptKey(token: string): string {
  return `${ATTEMPT_KEY_PREFIX}${tokenDigest(token)}`;
}

export function isTrustedPendingMfaChallenge(
  value: unknown,
): value is PendingMfaChallenge {
  return typeof value === "object" && value !== null && trustedChallenges.has(value);
}

export function createMfaChallengeService(
  store: MfaChallengeStore | null,
  now: () => number = Date.now,
) {
  async function createPendingMfaChallenge({
    userId,
    primaryAuthMethod,
    purpose = "LOGIN",
    sessionId,
    factorStateVersion,
  }: {
    userId: string;
    primaryAuthMethod: MfaPrimaryAuthMethod;
    purpose?: MfaChallengePurpose;
    sessionId?: string;
    factorStateVersion?: string;
  }): Promise<CreatedMfaChallenge> {
    if (
      typeof userId !== "string" ||
      userId.trim().length === 0 ||
      userId.length > USER_ID_MAX_LENGTH ||
      /[\u0000-\u001f\u007f]/.test(userId) ||
      !isPrimaryAuthMethod(primaryAuthMethod) ||
      (purpose !== "LOGIN" && purpose !== "STEP_UP" && purpose !== "ENROLLMENT") ||
      (purpose === "STEP_UP" &&
        (typeof sessionId !== "string" || !SAFE_CONTEXT_VALUE.test(sessionId))) ||
      (purpose === "LOGIN" && sessionId !== undefined) ||
      (factorStateVersion !== undefined &&
        (typeof factorStateVersion !== "string" || !SAFE_CONTEXT_VALUE.test(factorStateVersion)))
    ) {
      throw new Error("A verified user and primary authentication method are required.");
    }
    if (!store) throw new Error("Pending MFA challenge storage is unavailable.");

    const issuedAt = now();
    if (!Number.isSafeInteger(issuedAt) || issuedAt < 0) {
      throw new Error("Pending MFA challenge storage is unavailable.");
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = issuedAt + MFA_CHALLENGE_TTL_SECONDS * 1000;
    const challenge: PendingMfaChallenge = {
      userId,
      primaryAuthMethod,
      purpose,
      primaryAuthenticationEventId: randomUUID(),
      ...(purpose === "STEP_UP" ? { sessionId } : {}),
      ...(factorStateVersion ? { factorStateVersion } : {}),
      expiresAt,
    };

    try {
      const result = await store.set(tokenKey(token), JSON.stringify(challenge), {
        ex: MFA_CHALLENGE_TTL_SECONDS,
        nx: true,
      });
      if (result !== "OK") throw new Error("Challenge was not stored.");
    } catch {
      throw new Error("Pending MFA challenge storage is unavailable.");
    }
    return { token, expiresAt };
  }

  async function readChallenge(
    token: unknown,
    consume: boolean,
  ): Promise<PendingMfaChallenge | null> {
    if (typeof token !== "string" || !TOKEN_PATTERN.test(token) || !store) return null;
    const currentTime = now();
    if (!Number.isSafeInteger(currentTime) || currentTime < 0) return null;

    try {
      const raw = consume
        ? await store.getdel(tokenKey(token))
        : await store.get(tokenKey(token));
      const challenge = decodeChallenge(raw);
      if (consume) await store.del(attemptKey(token));
      if (!challenge || challenge.expiresAt <= currentTime) return null;
      return challenge;
    } catch {
      return null;
    }
  }

  return {
    createPendingMfaChallenge,
    getPendingMfaChallenge: (token: unknown) => readChallenge(token, false),
    consumePendingMfaChallenge: (token: unknown) => readChallenge(token, true),
    async recordFailedMfaAttempt(token: unknown): Promise<number | null> {
      if (typeof token !== "string" || !TOKEN_PATTERN.test(token) || !store) return null;
      try {
        const result = await store.recordFailedAttempt(
          tokenKey(token),
          attemptKey(token),
          MFA_CHALLENGE_TTL_SECONDS,
          MFA_CHALLENGE_MAX_ATTEMPTS,
        );
        if (!Number.isSafeInteger(result) || (result as number) < 0) return null;
        return result as number;
      } catch {
        return null;
      }
    },
  };
}
