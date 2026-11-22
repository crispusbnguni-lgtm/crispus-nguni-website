import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { argon2id, hash as argonHash, verify as argonVerify } from "argon2";
import QRCode from "qrcode";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAccountAccessAllowed } from "@/lib/account-access";
import { getCurrentSessionDetails, getCurrentUser } from "@/lib/auth";
import { checkMfaRateLimit } from "@/lib/rate-limit";
import {
  consumePendingMfaChallenge,
  createPendingMfaChallenge,
  getPendingMfaChallenge,
  recordFailedMfaAttempt,
  type MfaPrimaryAuthMethod,
  type PendingMfaChallenge,
} from "@/lib/mfa-challenges";
import {
  resolveMfaChallengeSecurityActor,
  resolveSecurityAuditActor,
  writeSecurityAudit,
  type MfaSecurityAuditAction,
  type TrustedSecurityAuditActor,
} from "@/lib/admin-audit";
import {
  createTotpProvisioningUri,
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  normalizeRecoveryCode,
  readTotpEncryptionKeyring,
  verifyTotpCode,
} from "@/lib/mfa-security-core";

export const MFA_FRESH_AUTH_WINDOW_MS = 5 * 60 * 1000;
export const MFA_ENROLLMENT_TTL_MS = 10 * 60 * 1000;
const RECOVERY_HASH_OPTIONS = { type: argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export type MfaFactorMethod = "TOTP" | "RECOVERY_CODE";
export type MfaChallengeCompletion = Readonly<{
  userId: string;
  primaryAuthMethod: MfaPrimaryAuthMethod;
  primaryAuthenticationEventId: string;
  purpose: "LOGIN" | "STEP_UP";
  sessionId?: string;
  secondFactorMethod: MfaFactorMethod;
  verifiedAt: Date;
}>;

const verifiedCompletions = new WeakSet<object>();

export function isVerifiedMfaChallengeCompletion(value: unknown): value is MfaChallengeCompletion {
  return typeof value === "object" && value !== null && verifiedCompletions.has(value);
}

type AuthenticatedContext = {
  userId: string;
  role: "USER" | "SUPER_ADMIN";
  email: string | null;
  sessionId: string;
  actor: TrustedSecurityAuditActor;
};

function requireRecentAuthentication(lastReauthenticatedAt: Date | null, now: Date): void {
  const value = lastReauthenticatedAt?.getTime();
  if (!Number.isFinite(value) || value === undefined || value > now.getTime() || now.getTime() - value > MFA_FRESH_AUTH_WINDOW_MS) {
    throw new Error("Recent authentication is required for this security change.");
  }
}

async function requireAuthenticatedContext(): Promise<AuthenticatedContext> {
  const [user, session] = await Promise.all([getCurrentUser(), getCurrentSessionDetails()]);
  if (!user || !session || user.id !== session.userId) throw new Error("Authentication required.");
  requireRecentAuthentication(session.lastReauthenticatedAt, new Date());
  if (user.role !== "USER" && user.role !== "SUPER_ADMIN") throw new Error("Authentication required.");
  const actor = await resolveSecurityAuditActor();
  if (actor.userId !== user.id) throw new Error("Authentication required.");
  return { userId: user.id, role: user.role, email: user.email ?? null, sessionId: session.id, actor };
}

async function requireRateLimit(request: Request, userId: string, action: "challenge-verify" | "enrollment" | "recovery") {
  const result = await checkMfaRateLimit({ request, userId, action });
  if (result.unavailable) throw new Error("MFA security service is temporarily unavailable.");
  if (result.limited) throw new Error("Too many MFA attempts. Please try again later.");
}

function securityAudit(
  action: MfaSecurityAuditAction,
  userId: string,
  outcome: "SUCCEEDED" | "FAILED",
  resultCode: string,
  authenticationMethod?: MfaFactorMethod,
) {
  return {
    action,
    targetType: "User" as const,
    targetId: userId,
    metadata: { resultCode, ...(authenticationMethod ? { authenticationMethod } : {}) },
    reason: outcome === "FAILED" ? "SECURITY_RESPONSE" as const : "USER_REQUEST" as const,
    outcome,
  };
}

async function factorStateVersion(userId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const [credential, generation] = await Promise.all([
    tx.totpCredential.findUnique({ where: { userId } }),
    tx.recoveryCode.findFirst({
      where: { userId, revokedAt: null, generationId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { generationId: true },
    }),
  ]);
  const state = [
    credential?.id ?? "",
    credential?.verifiedAt?.toISOString() ?? "",
    credential?.secretCiphertext ?? "",
    credential?.pendingSecretCiphertext ?? "",
    credential?.enrollmentExpiresAt?.toISOString() ?? "",
    generation?.generationId ?? "",
  ].join("\u0000");
  return { credential, version: createHash("sha256").update(state).digest("base64url") };
}

type TotpCredentialRow = NonNullable<Awaited<ReturnType<typeof prisma.totpCredential.findUnique>>>;

function isEnabled(
  credential: TotpCredentialRow | null,
): credential is TotpCredentialRow & { verifiedAt: Date } {
  return Boolean(credential?.verifiedAt && Number.isFinite(credential.verifiedAt.getTime()));
}

/** Derive policy from the verified database role and enrolled credential. */
export function isMfaRequired(role: unknown, hasVerifiedTotp: boolean): boolean {
  return role === "SUPER_ADMIN" || (role === "USER" && hasVerifiedTotp);
}

/** Call only after the server has verified the primary authentication method. */
export async function createPendingMfaChallengeForVerifiedPrimary(input: {
  userId: string;
  primaryAuthMethod: MfaPrimaryAuthMethod;
}): Promise<{ required: false } | { required: true; enrollmentRequired: true; authorization: { token: string; expiresAt: number } } | {
  required: true; enrollmentRequired: false; challenge: { token: string; expiresAt: number };
}> {
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: {
    id: true,
    role: true,
    accountStatus: true,
    accountSuspendedUntil: true,
    verificationStatus: true,
  } });
  if (
    !user ||
    !isAccountAccessAllowed(user) ||
    (user.role !== "USER" && user.role !== "SUPER_ADMIN")
  ) {
    throw new Error("Authentication could not be completed.");
  }

  // Super Admin MFA enrollment is optional at login.
  // Primary authentication and account access checks remain mandatory.
  if (user.role === "SUPER_ADMIN") {
    return { required: false };
  }

  const state = await factorStateVersion(user.id);
  const enabled = isEnabled(state.credential);
  const required = isMfaRequired(user.role, enabled);
  if (!required) return { required: false };
  if (!enabled) {
    const authorization = await createPendingMfaChallenge({
      userId: user.id,
      primaryAuthMethod: input.primaryAuthMethod,
      purpose: "ENROLLMENT",
      factorStateVersion: state.version,
    });
    return { required: true, enrollmentRequired: true, authorization };
  }
  const challenge = await createPendingMfaChallenge({
    userId: user.id,
    primaryAuthMethod: input.primaryAuthMethod,
    purpose: "LOGIN",
    factorStateVersion: state.version,
  });
  return { required: true, enrollmentRequired: false, challenge };
}

/** Issue only after primary authentication; the opaque token grants enrollment operations only. */
export async function createPendingMfaEnrollmentAuthorization(input: {
  userId: string;
  primaryAuthMethod: MfaPrimaryAuthMethod;
}): Promise<{ token: string; expiresAt: number }> {
  const decision = await createPendingMfaChallengeForVerifiedPrimary(input);
  if (!decision.required || !decision.enrollmentRequired) {
    throw new Error("MFA enrollment is not required for this account.");
  }
  return decision.authorization;
}

/** Attach only a server-minted enrollment token to a response after primary authentication. */
export function setPendingMfaEnrollmentCookie(
  response: NextResponse,
  authorization: { token: string; expiresAt: number },
): void {
  const maxAge = Math.max(0, Math.min(300, Math.floor((authorization.expiresAt - Date.now()) / 1000)));
  if (!/^[A-Za-z0-9_-]{43}$/.test(authorization.token) || maxAge === 0) throw new Error("Enrollment authorization is invalid or expired.");
  response.cookies.set("mfa_enrollment_pending", authorization.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth/mfa/enrollment",
    maxAge,
  });
}

async function requireEnrollmentAuthorization(token: unknown): Promise<PendingMfaChallenge> {
  const challenge = await getPendingMfaChallenge(token);
  if (!challenge || challenge.purpose !== "ENROLLMENT" || !challenge.factorStateVersion) {
    throw new Error("Enrollment authorization is invalid or expired.");
  }
  const [user, state] = await Promise.all([
    prisma.user.findUnique({ where: { id: challenge.userId }, select: {
      id: true, role: true, accountStatus: true, accountSuspendedUntil: true, verificationStatus: true,
    } }),
    factorStateVersion(challenge.userId),
  ]);
  if (!user || !isAccountAccessAllowed(user) || (user.role !== "USER" && user.role !== "SUPER_ADMIN") || isEnabled(state.credential) || state.version !== challenge.factorStateVersion) {
    throw new Error("Enrollment authorization is invalid or expired.");
  }
  return challenge;
}

export async function beginPreAuthTotpEnrollment(request: Request, token: unknown): Promise<{ qrCodeDataUrl: string; manualSetupKey: string; expiresAt: Date }> {
  const challenge = await requireEnrollmentAuthorization(token);
  await requireRateLimit(request, challenge.userId, "enrollment");
  const actor = await resolveMfaChallengeSecurityActor(challenge);
  const keyring = readTotpEncryptionKeyring();
  const secret = generateTotpSecret();
  const ciphertext = encryptTotpSecret(secret, keyring);
  const uri = createTotpProvisioningUri(secret, challenge.userId);
  const qrCodeDataUrl = await QRCode.toDataURL(uri, { errorCorrectionLevel: "M", margin: 2, width: 256 });
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MFA_ENROLLMENT_TTL_MS);
  const setupExpiresAt = new Date(Math.min(expiresAt.getTime(), challenge.expiresAt));
  await prisma.$transaction(async (tx) => {
    const current = await tx.totpCredential.findUnique({ where: { userId: challenge.userId } });
    if (current?.verifiedAt) throw new Error("An active authenticator already exists.");
    if (current) {
      await tx.totpCredential.update({ where: { id: current.id }, data: { secretCiphertext: ciphertext, pendingSecretCiphertext: null, enrollmentExpiresAt: setupExpiresAt } });
    } else {
      await tx.totpCredential.create({ data: { userId: challenge.userId, secretCiphertext: ciphertext, enrollmentExpiresAt: setupExpiresAt } });
    }
    await writeSecurityAudit(actor, securityAudit("AUTH_MFA_ENROLLMENT_STARTED", challenge.userId, "SUCCEEDED", "ENROLLMENT_STARTED"), tx);
  });
  return { qrCodeDataUrl, manualSetupKey: secret, expiresAt: setupExpiresAt };
}

/** Confirms TOTP, consumes the pending authorization, then creates the verified session. */
export async function confirmPreAuthTotpEnrollment(request: Request, token: unknown, code: unknown): Promise<{ enabled: boolean; reason?: "INVALID_CODE" | "EXPIRED"; recoveryCodes?: string[] }> {
  const challenge = await requireEnrollmentAuthorization(token);
  await requireRateLimit(request, challenge.userId, "enrollment");
  const actor = await resolveMfaChallengeSecurityActor(challenge);
  const now = new Date();
  const enrollmentCodes = generateRecoveryCodes();
  const recoveryHashes = await Promise.all(enrollmentCodes.map((value) => argonHash(normalizeRecoveryCode(value)!, RECOVERY_HASH_OPTIONS)));
  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: challenge.userId }, select: {
      id: true, role: true, accountStatus: true, accountSuspendedUntil: true, verificationStatus: true,
    } });
    if (!user || !isAccountAccessAllowed(user, now)) throw new Error("Account access is unavailable.");
    const credential = await tx.totpCredential.findUnique({ where: { userId: challenge.userId } });
    if (!credential?.enrollmentExpiresAt || credential.enrollmentExpiresAt <= now) return { ok: false as const, reason: "EXPIRED" as const };
    if (credential.verifiedAt) throw new Error("An active authenticator already exists.");
    const secret = decryptTotpSecret(credential.secretCiphertext, readTotpEncryptionKeyring());
    const step = await verifyTotpCode(secret, code, now.getTime());
    if (step === null) return { ok: false as const, reason: "INVALID_CODE" as const };
    const changed = await tx.totpCredential.updateMany({
      where: { id: credential.id, userId: challenge.userId, verifiedAt: null, updatedAt: credential.updatedAt, enrollmentExpiresAt: { gt: now } },
      data: { verifiedAt: now, lastAcceptedStep: BigInt(step), enrollmentExpiresAt: null },
    });
    if (changed.count !== 1) throw new Error("Enrollment changed; start again.");
    await tx.recoveryCode.createMany({ data: recoveryHashes.map((codeHash) => ({ userId: challenge.userId, codeHash, generationId: randomUUID() })) });
    await writeSecurityAudit(actor, securityAudit("AUTH_MFA_ENROLLMENT_COMPLETED", challenge.userId, "SUCCEEDED", "FACTOR_ENABLED", "TOTP"), tx);
    return { ok: true as const };
  });
  if (!updated.ok) return { enabled: false, reason: updated.reason };
  const consumed = await consumePendingMfaChallenge(token);
  if (!consumed || consumed.purpose !== "ENROLLMENT" || consumed.userId !== challenge.userId || consumed.primaryAuthenticationEventId !== challenge.primaryAuthenticationEventId) {
    throw new Error("Enrollment authorization was already consumed.");
  }
  const currentUser = await prisma.user.findUnique({ where: { id: challenge.userId }, select: {
    id: true, role: true, accountStatus: true, accountSuspendedUntil: true, verificationStatus: true,
  } });
  const currentState = await factorStateVersion(challenge.userId);
  if (!currentUser || !isAccountAccessAllowed(currentUser) || (currentUser.role !== "USER" && currentUser.role !== "SUPER_ADMIN") || !isEnabled(currentState.credential) || currentState.version === challenge.factorStateVersion) {
    throw new Error("MFA enrollment could not be completed.");
  }
  await import("@/lib/auth").then(({ createSession }) => createSession(challenge.userId, request, {
    primaryAuthMethod: challenge.primaryAuthMethod,
    verifiedMfa: { secondFactorMethod: "TOTP", verifiedAt: now },
  }));
  return { enabled: true, recoveryCodes: enrollmentCodes };
}

export async function beginTotpEnrollment(request: Request, replacementProof?: unknown): Promise<{ qrCodeDataUrl: string; expiresAt: Date }> {
  const context = await requireAuthenticatedContext();
  await requireRateLimit(request, context.userId, "enrollment");
  const keyring = readTotpEncryptionKeyring();
  const secret = generateTotpSecret();
  const encrypted = encryptTotpSecret(secret, keyring);
  const provisioningUri = createTotpProvisioningUri(secret, context.email ?? context.userId);
  const qrCodeDataUrl = await QRCode.toDataURL(provisioningUri, { errorCorrectionLevel: "M", margin: 2, width: 256 });
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MFA_ENROLLMENT_TTL_MS);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.totpCredential.findUnique({ where: { userId: context.userId } });
    if (existing) {
      if (existing.verifiedAt) {
        if (replacementProof === undefined) throw new Error("A current MFA factor is required to replace an authenticator.");
        const method = await verifyAndConsumeFactor(tx, context.userId, replacementProof, now, context.actor);
        if (!method) throw new Error("A valid current MFA factor is required to replace an authenticator.");
      }
      await tx.totpCredential.update({
        where: { id: existing.id, userId: context.userId },
        data: existing.verifiedAt
          ? { pendingSecretCiphertext: encrypted, enrollmentExpiresAt: expiresAt }
          : { secretCiphertext: encrypted, pendingSecretCiphertext: null, enrollmentExpiresAt: expiresAt },
      });
    } else {
      await tx.totpCredential.create({ data: { userId: context.userId, secretCiphertext: encrypted, enrollmentExpiresAt: expiresAt } });
    }
    await writeSecurityAudit(context.actor, securityAudit("AUTH_MFA_ENROLLMENT_STARTED", context.userId, "SUCCEEDED", "ENROLLMENT_STARTED"), tx);
  });
  return { qrCodeDataUrl, expiresAt };
}

export async function confirmTotpEnrollment(request: Request, code: unknown): Promise<{ enabled: boolean; replaced?: boolean; reason?: "INVALID_CODE" | "EXPIRED" }> {
  const context = await requireAuthenticatedContext();
  await requireRateLimit(request, context.userId, "challenge-verify");
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const credential = await tx.totpCredential.findUnique({ where: { userId: context.userId } });
    if (!credential?.enrollmentExpiresAt || credential.enrollmentExpiresAt <= now) return { ok: false as const, reason: "EXPIRED" as const };
    const envelope = credential.verifiedAt ? credential.pendingSecretCiphertext : credential.secretCiphertext;
    if (!envelope) return { ok: false as const, reason: "EXPIRED" as const };
    const secret = decryptTotpSecret(envelope, readTotpEncryptionKeyring());
    const step = await verifyTotpCode(secret, code, now.getTime());
    if (step === null) return { ok: false as const, reason: "INVALID_CODE" as const };
    const replaced = Boolean(credential.verifiedAt && credential.pendingSecretCiphertext);
    const update = await tx.totpCredential.updateMany({
      where: { id: credential.id, userId: context.userId, updatedAt: credential.updatedAt, enrollmentExpiresAt: { gt: now } },
      data: {
        secretCiphertext: replaced ? credential.pendingSecretCiphertext! : credential.secretCiphertext,
        pendingSecretCiphertext: null,
        enrollmentExpiresAt: null,
        verifiedAt: now,
        lastAcceptedStep: BigInt(step),
      },
    });
    if (update.count !== 1) throw new Error("Authenticator enrollment changed; start again.");
    const sessionUpdate = await tx.userSession.updateMany({
      where: { id: context.sessionId, userId: context.userId, revokedAt: null, expiresAt: { gt: now } },
      data: { mfaVerifiedAt: now, secondFactorMethod: "TOTP" },
    });
    if (sessionUpdate.count !== 1) throw new Error("The active session changed during MFA enrollment.");
    await tx.userSession.updateMany({
      where: { userId: context.userId, id: { not: context.sessionId }, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    });
    await writeSecurityAudit(context.actor, securityAudit(replaced ? "AUTH_MFA_FACTOR_REPLACED" : "AUTH_MFA_ENROLLMENT_COMPLETED", context.userId, "SUCCEEDED", replaced ? "FACTOR_REPLACED" : "FACTOR_ENABLED", "TOTP"), tx);
    return { ok: true as const, replaced };
  });
  if (!result.ok) {
    if (result.reason === "INVALID_CODE") {
      await writeSecurityAudit(context.actor, securityAudit("AUTH_MFA_ENROLLMENT_FAILED", context.userId, "FAILED", "INVALID_TOTP"));
    }
    return { enabled: false, reason: result.reason };
  }
  return { enabled: true, replaced: result.replaced };
}

type ConsumedFactor = { method: MfaFactorMethod; recoveryCodeId?: string };

async function verifyAndConsumeFactor(
  tx: Prisma.TransactionClient,
  userId: string,
  code: unknown,
  now: Date,
  actor: TrustedSecurityAuditActor,
): Promise<ConsumedFactor | null> {
  const credential = await tx.totpCredential.findUnique({ where: { userId } });
  if (!isEnabled(credential)) return null;

  if (typeof code === "string" && /^\d{6}$/.test(code)) {
    const secret = decryptTotpSecret(credential.secretCiphertext, readTotpEncryptionKeyring());
    const step = await verifyTotpCode(secret, code, now.getTime(), credential.lastAcceptedStep);
    if (step === null) return null;
    const result = await tx.totpCredential.updateMany({
      where: {
        id: credential.id,
        userId,
        verifiedAt: credential.verifiedAt,
        updatedAt: credential.updatedAt,
        OR: [
          { lastAcceptedStep: null },
          { lastAcceptedStep: { lt: BigInt(step) } },
        ],
      },
      data: { lastAcceptedStep: BigInt(step) },
    });
    return result.count === 1 ? { method: "TOTP" } : null;
  }

  const normalized = normalizeRecoveryCode(code);
  if (!normalized) return null;
  const records = await tx.recoveryCode.findMany({
    where: { userId, usedAt: null, revokedAt: null },
    select: { id: true, codeHash: true },
    take: 20,
  });
  for (const record of records) {
    if (!(await argonVerify(record.codeHash, normalized))) continue;
    const result = await tx.recoveryCode.updateMany({
      where: { id: record.id, userId, usedAt: null, revokedAt: null },
      data: { usedAt: now },
    });
    if (result.count !== 1) return null;
    const serialized = await tx.totpCredential.updateMany({
      where: {
        id: credential.id,
        userId,
        verifiedAt: credential.verifiedAt,
        updatedAt: credential.updatedAt,
      },
      data: { updatedAt: now },
    });
    if (serialized.count !== 1) throw new Error("MFA state changed during recovery-code use.");
    await writeSecurityAudit(
      actor,
      securityAudit("AUTH_RECOVERY_CODE_CONSUMED", userId, "SUCCEEDED", "RECOVERY_CODE_CONSUMED", "RECOVERY_CODE"),
      tx,
    );
    return { method: "RECOVERY_CODE", recoveryCodeId: record.id };
  }
  return null;
}

async function factorProofAppearsValid(userId: string, code: unknown): Promise<boolean> {
  if (typeof code === "string" && /^\d{6}$/.test(code)) {
    const credential = await prisma.totpCredential.findUnique({ where: { userId } });
    if (!isEnabled(credential)) return false;
    const secret = decryptTotpSecret(credential.secretCiphertext, readTotpEncryptionKeyring());
    return (await verifyTotpCode(secret, code, Date.now(), credential.lastAcceptedStep)) !== null;
  }
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) return false;
  const records = await prisma.recoveryCode.findMany({
    where: { userId, usedAt: null, revokedAt: null },
    select: { codeHash: true },
    take: 20,
  });
  for (const record of records) {
    if (await argonVerify(record.codeHash, normalized)) return true;
  }
  return false;
}

function sameChallenge(a: PendingMfaChallenge, b: PendingMfaChallenge): boolean {
  return a.userId === b.userId &&
    a.primaryAuthMethod === b.primaryAuthMethod &&
    a.primaryAuthenticationEventId === b.primaryAuthenticationEventId &&
    a.purpose === b.purpose &&
    a.sessionId === b.sessionId &&
    a.factorStateVersion === b.factorStateVersion &&
    a.expiresAt === b.expiresAt;
}

export async function verifyPendingMfaChallenge(
  request: Request,
  token: unknown,
  code: unknown,
): Promise<
  | { status: "verified"; completion: MfaChallengeCompletion }
  | { status: "invalid"; attemptsRemaining: number }
  | { status: "unavailable" }
> {
  const challenge = await getPendingMfaChallenge(token);
  if (!challenge || (challenge.purpose !== "LOGIN" && challenge.purpose !== "STEP_UP") || !challenge.factorStateVersion) return { status: "unavailable" };
  const limit = await checkMfaRateLimit({ request, userId: challenge.userId, action: "challenge-verify" });
  if (limit.unavailable || limit.limited) return { status: "unavailable" };

  const user = await prisma.user.findUnique({ where: { id: challenge.userId }, select: {
    id: true, role: true, accountStatus: true, accountSuspendedUntil: true, verificationStatus: true,
  } });
  const state = await factorStateVersion(challenge.userId);
  if (
    !user ||
    !isAccountAccessAllowed(user) ||
    (user.role !== "USER" && user.role !== "SUPER_ADMIN") ||
    !isEnabled(state.credential) ||
    !isMfaRequired(user.role, true) ||
    state.version !== challenge.factorStateVersion
  ) return { status: "unavailable" };

  if (challenge.purpose === "STEP_UP") {
    const session = await getCurrentSessionDetails();
    if (!challenge.sessionId || !session || session.id !== challenge.sessionId || session.userId !== challenge.userId) {
      return { status: "unavailable" };
    }
  }

  let valid = false;
  try {
    valid = await factorProofAppearsValid(challenge.userId, code);
  } catch {
    return { status: "unavailable" };
  }
  if (!valid) {
    const attemptsRemaining = await recordFailedMfaAttempt(token);
    if (attemptsRemaining === null) return { status: "unavailable" };
    try {
      const actor = await resolveMfaChallengeSecurityActor(challenge);
      await writeSecurityAudit(
        actor,
        securityAudit(
          "AUTH_MFA_CHALLENGE_FAILED",
          challenge.userId,
          "FAILED",
          attemptsRemaining === 0 ? "ATTEMPTS_EXHAUSTED" : "INVALID_FACTOR",
        ),
      );
    } catch {
      // The factor remains failed and rate limited; no authentication is granted.
    }
    return { status: "invalid", attemptsRemaining };
  }

  // Verification happens before GETDEL so an incorrect code can be retried.
  // Only the successful contender consumes the challenge and proceeds.
  const consumed = await consumePendingMfaChallenge(token);
  if (!consumed || (consumed.purpose !== "LOGIN" && consumed.purpose !== "STEP_UP") || !sameChallenge(challenge, consumed)) return { status: "unavailable" };
  const actor = await resolveMfaChallengeSecurityActor(consumed);
  const now = new Date();
  try {
    const factor = await prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({ where: { id: consumed.userId }, select: {
        id: true, role: true, accountStatus: true, accountSuspendedUntil: true, verificationStatus: true,
      } });
      if (!currentUser || !isAccountAccessAllowed(currentUser, now) || (currentUser.role !== "USER" && currentUser.role !== "SUPER_ADMIN")) {
        throw new Error("MFA account state changed.");
      }
      const currentState = await factorStateVersion(consumed.userId, tx);
      if (!isEnabled(currentState.credential) || currentState.version !== consumed.factorStateVersion) {
        throw new Error("MFA factor changed during verification.");
      }
      if (consumed.purpose === "STEP_UP") {
        const sessionUpdate = await tx.userSession.updateMany({
          where: { id: consumed.sessionId!, userId: consumed.userId, revokedAt: null, expiresAt: { gt: now } },
          data: { lastActiveAt: now },
        });
        if (sessionUpdate.count !== 1) throw new Error("The session is no longer active.");
      }
      const verifiedFactor = await verifyAndConsumeFactor(tx, consumed.userId, code, now, actor);
      if (!verifiedFactor) throw new Error("The factor could not be consumed.");
      await writeSecurityAudit(actor, securityAudit("AUTH_MFA_CHALLENGE_COMPLETED", consumed.userId, "SUCCEEDED", "MFA_VERIFIED", verifiedFactor.method), tx);
      return verifiedFactor;
    });
    const completion: MfaChallengeCompletion = Object.freeze({
      userId: consumed.userId,
      primaryAuthMethod: consumed.primaryAuthMethod,
      primaryAuthenticationEventId: consumed.primaryAuthenticationEventId,
      purpose: consumed.purpose,
      ...(consumed.sessionId ? { sessionId: consumed.sessionId } : {}),
      secondFactorMethod: factor.method,
      verifiedAt: now,
    });
    verifiedCompletions.add(completion);
    return { status: "verified", completion };
  } catch {
    // The challenge is consumed, but no completion is returned if persistence,
    // session revalidation, factor state, or the audit transaction fails.
    return { status: "unavailable" };
  }
}

export async function rotateRecoveryCodes(
  request: Request,
  verificationCode: unknown,
): Promise<{ codes: string[]; generationId: string }> {
  const context = await requireAuthenticatedContext();
  await requireRateLimit(request, context.userId, "recovery");
  const codes = generateRecoveryCodes();
  const generationId = randomUUID();
  const hashes = await Promise.all(
    codes.map((code) => argonHash(normalizeRecoveryCode(code)!, RECOVERY_HASH_OPTIONS)),
  );
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const method = await verifyAndConsumeFactor(tx, context.userId, verificationCode, now, context.actor);
    if (!method) throw new Error("A valid current MFA factor is required.");
    const previous = await tx.recoveryCode.updateMany({
      where: { userId: context.userId, usedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    await tx.recoveryCode.createMany({
      data: hashes.map((codeHash) => ({ userId: context.userId, codeHash, generationId })),
    });
    const sessionUpdate = await tx.userSession.updateMany({
      where: { id: context.sessionId, userId: context.userId, revokedAt: null, expiresAt: { gt: now } },
      data: { mfaVerifiedAt: now, secondFactorMethod: method.method },
    });
    if (sessionUpdate.count !== 1) throw new Error("The active session changed during recovery-code rotation.");
    await tx.userSession.updateMany({
      where: { userId: context.userId, id: { not: context.sessionId }, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    });
    await writeSecurityAudit(
      context.actor,
      securityAudit(
        previous.count ? "AUTH_RECOVERY_CODES_ROTATED" : "AUTH_RECOVERY_CODES_GENERATED",
        context.userId,
        "SUCCEEDED",
        previous.count ? "RECOVERY_CODES_ROTATED" : "RECOVERY_CODES_GENERATED",
        method.method,
      ),
      tx,
    );
  });

  // Plaintext codes are returned once and are never persisted or logged.
  return { codes, generationId };
}

export async function disableTotp(
  request: Request,
  verificationCode: unknown,
): Promise<{ disabled: true }> {
  const context = await requireAuthenticatedContext();
  if (context.role === "SUPER_ADMIN") {
    throw new Error("Super Admin MFA cannot be disabled through self-service.");
  }
  await requireRateLimit(request, context.userId, "recovery");
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const method = await verifyAndConsumeFactor(tx, context.userId, verificationCode, now, context.actor);
    if (!method) throw new Error("A valid current MFA factor is required.");
    await tx.totpCredential.deleteMany({ where: { userId: context.userId } });
    await tx.recoveryCode.updateMany({
      where: { userId: context.userId, usedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    await tx.userSession.updateMany({
      where: {
        userId: context.userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { revokedAt: now },
    });
    await writeSecurityAudit(
      context.actor,
      securityAudit("AUTH_MFA_DISABLED", context.userId, "SUCCEEDED", "MFA_DISABLED", method.method),
      tx,
    );
  });
  return { disabled: true };
}
