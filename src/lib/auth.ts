
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { prisma } from "./prisma";
import { recordAdminAuditWriteFailure } from "./admin-audit-fallback";
import { isAccountAccessAllowed } from "./account-access";

const secret = process.env.AUTH_SECRET;

if (!secret) {
  throw new Error("AUTH_SECRET is not configured.");
}

const secretKey = new TextEncoder().encode(secret);

const SESSION_COOKIE = "portfolio_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
const ACTIVITY_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

type PrimaryAuthMethod =
  | "EMAIL"
  | "PHONE"
  | "GOOGLE"
  | "APPLE"
  | "PASSKEY";

export type VerifiedSecondFactorMethod = "TOTP" | "RECOVERY_CODE";

export type VerifiedMfaSessionMetadata = {
  secondFactorMethod: VerifiedSecondFactorMethod;
  verifiedAt: Date;
};

type AuditAttempt<T> =
  | { status: "completed"; value: T }
  | { status: "failed"; error: unknown }
  | { status: "timed_out" };

function settleAuditAttempt<T>(
  operation: () => T | PromiseLike<T>,
  timeoutMs: number,
): Promise<AuditAttempt<T>> {
  return new Promise((resolve) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ status: "timed_out" });
    }, timeoutMs);

    Promise.resolve()
      .then(operation)
      .then(
        (value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({ status: "completed", value });
        },
        (error: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({ status: "failed", error });
        },
      );
  });
}

type CreateSessionOptions = {
  primaryAuthMethod?: PrimaryAuthMethod;
  /** Set only by a trusted server-side flow after the second factor succeeds. */
  verifiedMfa?: VerifiedMfaSessionMetadata;
};

function isSupportedPrimaryAuthMethod(
  method: unknown,
): method is PrimaryAuthMethod {
  return (
    method === "EMAIL" ||
    method === "PHONE" ||
    method === "GOOGLE" ||
    method === "APPLE" ||
    method === "PASSKEY"
  );
}

function getVerifiedMfaMetadata(
  options: CreateSessionOptions | undefined,
  now: Date,
): VerifiedMfaSessionMetadata | undefined {
  if (
    !options ||
    !Object.prototype.hasOwnProperty.call(options, "verifiedMfa")
  ) {
    return undefined;
  }

  const metadata: unknown = options.verifiedMfa;

  if (
    !metadata ||
    typeof metadata !== "object" ||
    Array.isArray(metadata) ||
    Object.keys(metadata).length !== 2 ||
    !Object.prototype.hasOwnProperty.call(metadata, "secondFactorMethod") ||
    !Object.prototype.hasOwnProperty.call(metadata, "verifiedAt")
  ) {
    throw new TypeError("Invalid verified MFA session metadata.");
  }

  const verifiedMetadata = metadata as {
    secondFactorMethod?: unknown;
    verifiedAt?: unknown;
  };

  const method = verifiedMetadata.secondFactorMethod;

  if (method !== "TOTP" && method !== "RECOVERY_CODE") {
    throw new TypeError("Unsupported verified MFA method.");
  }

  if (
    !(verifiedMetadata.verifiedAt instanceof Date) ||
    !Number.isFinite(verifiedMetadata.verifiedAt.getTime()) ||
    verifiedMetadata.verifiedAt.getTime() > now.getTime()
  ) {
    throw new TypeError("Invalid verified MFA timestamp.");
  }

  return {
    secondFactorMethod: method,
    verifiedAt: verifiedMetadata.verifiedAt,
  };
}

type StoredMfaSessionMetadata = Readonly<{
  mfaVerifiedAt?: Date | null;
  secondFactorMethod?: unknown;
  primaryAuthMethod?: unknown;
}>;

/**
 * Super Admin sessions can be established using verified primary
 * authentication without MFA enrollment.
 *
 * If MFA evidence is present, it must be valid.
 * If MFA evidence is absent, a supported primary authentication
 * method must have been recorded in the session.
 */
function hasRequiredMfaSession(
  role: unknown,
  session: StoredMfaSessionMetadata,
  now: Date,
): boolean {
  if (role !== "SUPER_ADMIN") return true;

  const verifiedAt = session.mfaVerifiedAt;

  const hasMfaEvidence =
    session.mfaVerifiedAt != null ||
    session.secondFactorMethod != null;

  if (hasMfaEvidence) {
    return (
      verifiedAt instanceof Date &&
      Number.isFinite(verifiedAt.getTime()) &&
      verifiedAt.getTime() <= now.getTime() &&
      (session.secondFactorMethod === "TOTP" ||
        session.secondFactorMethod === "RECOVERY_CODE")
    );
  }

  return isSupportedPrimaryAuthMethod(session.primaryAuthMethod);
}

export async function logSuperAdminVerificationExemption(
  userId: string,
  authMethod: "EMAIL" | "PHONE" | "GOOGLE",
  verificationState: {
    emailVerified: boolean;
    phoneVerified?: boolean;
  },
) {
  let eventId: string;

  try {
    eventId = randomUUID();
  } catch {
    return { status: "unconfirmed" as const, eventId: null };
  }

  let data: {
    eventId: string;
    actorUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata: {
      authMethod: "EMAIL" | "PHONE" | "GOOGLE";
      emailVerified: boolean;
      phoneVerified?: boolean;
    };
  };

  try {
    data = {
      eventId,
      actorUserId: userId,
      action: "SUPER_ADMIN_UNVERIFIED_AUTHENTICATION",
      targetType: "User",
      targetId: userId,
      metadata: {
        authMethod,
        emailVerified: verificationState.emailVerified,
        ...(verificationState.phoneVerified === undefined
          ? {}
          : { phoneVerified: verificationState.phoneVerified }),
      },
    };
  } catch {
    return { status: "unconfirmed" as const, eventId };
  }

  const primaryAttempt = await settleAuditAttempt(
    () => prisma.auditLog.create({ data }),
    1_000,
  );

  if (primaryAttempt.status === "completed") {
    return { status: "primary_recorded" as const, eventId };
  }

  const primaryError =
    primaryAttempt.status === "failed"
      ? primaryAttempt.error
      : { code: "P1008" };

  // A lost response can follow a committed insert.
  // Confirm by the unique event ID first.
  const confirmation = await settleAuditAttempt(
    () =>
      prisma.auditLog.findUnique({
        where: { eventId },
        select: { eventId: true },
      }),
    500,
  );

  if (
    confirmation.status === "completed" &&
    confirmation.value?.eventId === eventId
  ) {
    return { status: "primary_recorded" as const, eventId };
  }

  try {
    const fallback = await recordAdminAuditWriteFailure({
      actor: {
        userId,
        role: "SUPER_ADMIN",
        authenticationMethod: authMethod,
      },
      primaryError,
      eventId,
    });

    return {
      status: "fallback_attempted" as const,
      eventId,
      fallback,
    };
  } catch {
    // Audit failures must not prevent an otherwise valid Super Admin login.
    return { status: "unconfirmed" as const, eventId };
  }
}

function getDeviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  let browser = "Browser";
  let operatingSystem = "Unknown OS";

  if (/Edg\//i.test(userAgent)) {
    browser = "Microsoft Edge";
  } else if (/OPR\/|Opera/i.test(userAgent)) {
    browser = "Opera";
  } else if (
    /Chrome\//i.test(userAgent) &&
    !/Chromium/i.test(userAgent)
  ) {
    browser = "Chrome";
  } else if (/Firefox\//i.test(userAgent)) {
    browser = "Firefox";
  } else if (
    /Safari\//i.test(userAgent) &&
    !/Chrome\//i.test(userAgent)
  ) {
    browser = "Safari";
  }

  if (/Windows/i.test(userAgent)) {
    operatingSystem = "Windows";
  } else if (/Android/i.test(userAgent)) {
    operatingSystem = "Android";
  } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
    operatingSystem = "iOS";
  } else if (/Mac OS X|Macintosh/i.test(userAgent)) {
    operatingSystem = "macOS";
  } else if (/Linux/i.test(userAgent)) {
    operatingSystem = "Linux";
  }

  return `${browser} on ${operatingSystem}`;
}

export async function createSession(
  userId: string,
  request?: Request,
  options?: CreateSessionOptions,
) {
  const now = new Date();

  const verifiedMfa = getVerifiedMfaMetadata(options, now);

  const expiresAt = new Date(
    now.getTime() + SESSION_DURATION_SECONDS * 1000,
  );

  const userAgent = request?.headers.get("user-agent") ?? null;

  const session = await prisma.$transaction(
    async (tx) => {
      const account = await tx.user.findUnique({
        where: { id: userId },
        select: {
          role: true,
          accountStatus: true,
          accountSuspendedUntil: true,
          verificationStatus: true,
        },
      });

      if (!account || !isAccountAccessAllowed(account, now)) {
        throw new Error("Account access is unavailable.");
      }

     if (account.role === "SUPER_ADMIN") {
  if (!isSupportedPrimaryAuthMethod(options?.primaryAuthMethod)) {
    throw new Error("A verified primary authentication method is required.");
  }
}

      return tx.userSession.create({
        data: {
          userId,
          primaryAuthMethod: options?.primaryAuthMethod ?? null,
          ...(verifiedMfa
            ? {
                secondFactorMethod: verifiedMfa.secondFactorMethod,
                mfaVerifiedAt: verifiedMfa.verifiedAt,
              }
            : {}),
          lastReauthenticatedAt: now,
          deviceLabel: getDeviceLabel(userAgent),
          userAgent: userAgent?.slice(0, 500) ?? null,
          lastActiveAt: now,
          expiresAt,
        },
      });
    },
    { isolationLevel: "Serializable" },
  );

  try {
    const token = await new SignJWT({
      userId,
      sid: session.id,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(secretKey);

    const cookieStore = await cookies();

    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_SECONDS,
    });
  } catch (error) {
    await prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    throw error;
  }
}

export async function getCurrentSessionDetails() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.userId !== "string" ||
      typeof payload.sid !== "string"
    ) {
      return null;
    }

    const now = new Date();

    const session = await prisma.userSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        userId: true,
        lastReauthenticatedAt: true,
        primaryAuthMethod: true,
        mfaVerifiedAt: true,
        secondFactorMethod: true,
        user: {
          select: {
            role: true,
            accountStatus: true,
            accountSuspendedUntil: true,
            verificationStatus: true,
          },
        },
      },
    });

    if (
      !session ||
      !isAccountAccessAllowed(session.user, now) ||
      !hasRequiredMfaSession(session.user.role, session, now)
    ) {
      return null;
    }

    return {
      id: session.id,
      userId: session.userId,
      lastReauthenticatedAt: session.lastReauthenticatedAt,
    };
  } catch {
    return null;
  }
}

export async function getCurrentSessionId(): Promise<string | null> {
  const session = await getCurrentSessionDetails();
  return session?.id ?? null;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    console.warn("[AUTH-DIAGNOSTIC] Missing portfolio_session cookie.");
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.userId !== "string" ||
      typeof payload.sid !== "string"
    ) {
      console.error("[AUTH-DIAGNOSTIC] Invalid JWT payload.");
      return null;
    }

    const now = new Date();

    const session = await prisma.userSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        lastActiveAt: true,
        primaryAuthMethod: true,
        mfaVerifiedAt: true,
        secondFactorMethod: true,
      },
    });

    if (!session) {
      console.error(
        "[AUTH-DIAGNOSTIC] Session not found, expired, or revoked.",
      );
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { portfolioSite: true },
    });

    if (!user) {
      console.error("[AUTH-DIAGNOSTIC] User record not found.");
      return null;
    }

    if (!isAccountAccessAllowed(user, now)) {
      console.error("[AUTH-DIAGNOSTIC] Account access denied.", {
        role: user.role,
        accountStatus: user.accountStatus,
        verificationStatus: user.verificationStatus,
      });
      return null;
    }

    if (!hasRequiredMfaSession(user.role, session, now)) {
      console.error("[AUTH-DIAGNOSTIC] MFA/session policy rejected.", {
        role: user.role,
        primaryAuthMethod: session.primaryAuthMethod,
        hasMfaVerifiedAt: session.mfaVerifiedAt !== null,
        secondFactorMethod: session.secondFactorMethod,
      });
      return null;
    }

    // Update activity at most once every five minutes.
    if (
      now.getTime() - session.lastActiveAt.getTime() >=
      ACTIVITY_UPDATE_INTERVAL_MS
    ) {
      await prisma.userSession.updateMany({
        where: {
          id: session.id,
          userId: payload.userId,
          revokedAt: null,
          expiresAt: { gt: now },
          lastActiveAt: {
            lt: new Date(
              now.getTime() - ACTIVITY_UPDATE_INTERVAL_MS,
            ),
          },
        },
        data: { lastActiveAt: now },
      });
    }

    console.info("[AUTH-DIAGNOSTIC] Session accepted.", {
      role: user.role,
      primaryAuthMethod: session.primaryAuthMethod,
    });

    return user;
  } catch (error) {
    console.error("[AUTH-DIAGNOSTIC] getCurrentUser failed:", error);
    return null;
  }
}

export async function logout() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    cookieStore.delete(SESSION_COOKIE);
    return;
  }

  let payload;

  try {
    const verified = await jwtVerify(token, secretKey);
    payload = verified.payload;
  } catch {
    cookieStore.delete(SESSION_COOKIE);
    return;
  }

  if (
    typeof payload.userId !== "string" ||
    typeof payload.sid !== "string"
  ) {
    cookieStore.delete(SESSION_COOKIE);
    return;
  }

  await prisma.userSession.updateMany({
    where: {
      id: payload.sid,
      userId: payload.userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  cookieStore.delete(SESSION_COOKIE);
}
