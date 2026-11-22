import "server-only";

import { Redis } from "@upstash/redis";

export type WebAuthnChallengePurpose =
  | "passkey-registration"
  | "passkey-authentication";

type WebAuthnConfig = {
  rpName: string;
  rpID: string;
  origin: string;
};

type StoredChallenge = {
  challenge: string;
  purpose: WebAuthnChallengePurpose;
  userId?: string;
};

const CHALLENGE_TTL_SECONDS = 300;

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : null;

function normalizeApplicationUrl(value: string, variableName: string): URL {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} must be a valid absolute URL.`);
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password
  ) {
    throw new Error(`${variableName} must use HTTP or HTTPS without credentials.`);
  }

  return url;
}

export function getWebAuthnConfig(): WebAuthnConfig {
  const appUrl = process.env.APP_URL?.trim();
  const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  const configuredUrl = appUrl || publicAppUrl;

  if (!configuredUrl) {
    throw new Error("APP_URL or NEXT_PUBLIC_APP_URL must be configured.");
  }

  const applicationUrl = normalizeApplicationUrl(
    configuredUrl,
    appUrl ? "APP_URL" : "NEXT_PUBLIC_APP_URL"
  );

  if (appUrl && publicAppUrl) {
    const publicUrl = normalizeApplicationUrl(
      publicAppUrl,
      "NEXT_PUBLIC_APP_URL"
    );

    if (applicationUrl.origin !== publicUrl.origin) {
      throw new Error(
        "APP_URL and NEXT_PUBLIC_APP_URL must have the same origin."
      );
    }
  }

  const hostname = applicationUrl.hostname.toLowerCase();

  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";

  if (process.env.NODE_ENV === "production") {
    if (applicationUrl.protocol !== "https:") {
      throw new Error("WebAuthn requires HTTPS in production.");
    }
  } else if (applicationUrl.protocol === "http:" && !isLocalhost) {
    throw new Error(
      "HTTP WebAuthn origins are permitted only on localhost during development."
    );
  }

  return {
    rpName: "Crispus Nguni",
    rpID: hostname,
    origin: applicationUrl.origin,
  };
}

function getRedis(): Redis {
  if (!redis) {
    throw new Error(
      "WebAuthn challenge storage is unavailable. Configure Upstash Redis."
    );
  }

  return redis;
}

function getChallengeKey(
  purpose: WebAuthnChallengePurpose,
  challenge: string
): string {
  return `webauthn:challenge:${purpose}:${challenge}`;
}

export async function storeWebAuthnChallenge({
  challenge,
  purpose,
  userId,
}: StoredChallenge): Promise<void> {
  if (!challenge || !challenge.trim()) {
    throw new Error("A valid WebAuthn challenge is required.");
  }

  if (purpose === "passkey-registration" && (!userId || !userId.trim())) {
    throw new Error("A user ID is required for passkey registration.");
  }

  const record: StoredChallenge = {
    challenge,
    purpose,
    ...(userId ? { userId } : {}),
  };

  await getRedis().set(
    getChallengeKey(purpose, challenge),
    JSON.stringify(record),
    { ex: CHALLENGE_TTL_SECONDS }
  );
}

export async function consumeWebAuthnChallenge({
  challenge,
  purpose,
  userId,
}: StoredChallenge): Promise<boolean> {
  if (!challenge || !challenge.trim()) {
    return false;
  }

  if (purpose === "passkey-registration" && (!userId || !userId.trim())) {
    return false;
  }

  const stored = await getRedis().getdel<string>(
    getChallengeKey(purpose, challenge)
  );

  if (!stored || typeof stored !== "string") {
    return false;
  }

  let record: StoredChallenge;

  try {
    record = JSON.parse(stored) as StoredChallenge;
  } catch {
    return false;
  }

  return (
    record.challenge === challenge &&
    record.purpose === purpose &&
    (record.userId ?? null) === (userId ?? null)
  );
}