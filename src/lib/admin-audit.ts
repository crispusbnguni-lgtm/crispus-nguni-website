
import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isTrustedPendingMfaChallenge,
  type PendingMfaChallenge,
} from "@/lib/mfa-challenges-core";

/** Persisted action values are kept stable; new actions must be added here. */
export const ADMIN_AUDIT_ACTIONS = [
  "SUPER_ADMIN_UNVERIFIED_AUTHENTICATION",
  "ADMIN_SESSION_REVOKED",
  "SESSION_REVOKED",
  "OTHER_SESSIONS_REVOKED",
  "ALL_SESSIONS_REVOKED",
  "PASSKEY_RENAMED",
  "PASSKEY_REVOKED",
  "LEAD_CREATED",
  "ADMIN_ACCOUNT_VIEWED",
  "ADMIN_SESSIONS_VIEWED",
  "ADMIN_ACCOUNT_VERIFIED",
  "ADMIN_ACCOUNT_VERIFICATION_REJECTED",
  "ADMIN_ACCOUNT_SUSPENDED",
  "ADMIN_ACCOUNT_BANNED",
  "ADMIN_ACCOUNT_REINSTATED",
  "ADMIN_ALL_SESSIONS_REVOKED",
  "ADMIN_ROLE_ASSIGNED",
  "ADMIN_ROLE_REVOKED",
  "ADMIN_PORTFOLIO_UPDATED",
  "ADMIN_PORTFOLIO_RESOURCE_CREATED",
  "ADMIN_PORTFOLIO_RESOURCE_UPDATED",
  "ADMIN_PORTFOLIO_RESOURCE_DELETED",
  "ADMIN_CMS_DRAFT_SAVED",
  "ADMIN_CMS_PUBLISHED",
  "ADMIN_CMS_VERSION_RESTORED",
  "ADMIN_CMS_SCHEDULED",
  "ADMIN_CMS_SCHEDULE_CANCELLED",
  "ADMIN_BACKGROUND_CREATED",
  "ADMIN_BACKGROUND_UPDATED",
  "ADMIN_BACKGROUND_DELETED",
  "ADMIN_BACKGROUND_MEDIA_UPLOADED",
  "ADMIN_BACKGROUND_MEDIA_DELETED",
  "ADMIN_DISPLAY_STUDIO_UPDATED",
  "ADMIN_AUDIT_VIEWED",
  "ADMIN_AUDIT_EXPORTED",
  "AUTH_MFA_ENROLLMENT_STARTED",
  "AUTH_MFA_ENROLLMENT_FAILED",
  "AUTH_MFA_ENROLLMENT_COMPLETED",
  "AUTH_MFA_FACTOR_REPLACED",
  "AUTH_MFA_DISABLED",
  "AUTH_RECOVERY_CODES_GENERATED",
  "AUTH_RECOVERY_CODES_ROTATED",
  "AUTH_RECOVERY_CODE_CONSUMED",
  "AUTH_MFA_CHALLENGE_FAILED",
  "AUTH_MFA_CHALLENGE_COMPLETED",
] as const;

export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];

export const MFA_SECURITY_AUDIT_ACTIONS = [
  "AUTH_MFA_ENROLLMENT_STARTED",
  "AUTH_MFA_ENROLLMENT_FAILED",
  "AUTH_MFA_ENROLLMENT_COMPLETED",
  "AUTH_MFA_FACTOR_REPLACED",
  "AUTH_MFA_DISABLED",
  "AUTH_RECOVERY_CODES_GENERATED",
  "AUTH_RECOVERY_CODES_ROTATED",
  "AUTH_RECOVERY_CODE_CONSUMED",
  "AUTH_MFA_CHALLENGE_FAILED",
  "AUTH_MFA_CHALLENGE_COMPLETED",
] as const satisfies readonly AdminAuditAction[];

export type MfaSecurityAuditAction =
  (typeof MFA_SECURITY_AUDIT_ACTIONS)[number];

export type AdminAuditOutcome = "SUCCEEDED" | "FAILED" | "DENIED";

export type AdminAuditReason =
  | "ADMIN_REQUEST"
  | "USER_REQUEST"
  | "SECURITY_RESPONSE"
  | "POLICY_ENFORCEMENT"
  | "CONTENT_POLICY"
  | "OTHER";

export const ADMIN_AUDIT_TARGET_TYPES = [
  "User",
  "UserSession",
  "PortfolioSite",
  "Project",
  "Education",
  "Experience",
  "Skill",
  "Insight",
  "Testimonial",
  "WelcomePageSettings",
  "BackgroundOption",
  "MediaAsset",
  "DisplayStudioSettings",
  "AuditLog",
] as const;

export type AdminAuditTargetType =
  (typeof ADMIN_AUDIT_TARGET_TYPES)[number];

declare const trustedActorBrand: unique symbol;

/** Created only by resolveAdminAuditActor() after resolving the signed session. */
export type TrustedAdminAuditActor = Readonly<{
  userId: string;
  role: "SUPER_ADMIN";
  readonly [trustedActorBrand]: true;
}>;

declare const trustedSecurityActorBrand: unique symbol;

export type TrustedSecurityAuditActor = Readonly<{
  userId: string;
  role: "USER" | "SUPER_ADMIN";
  readonly [trustedSecurityActorBrand]: true;
}>;

export type AdminAuditMetadataInput = Readonly<Record<string, unknown>>;

export type AdminAuditWriteInput = Readonly<{
  action: AdminAuditAction;
  targetType?: AdminAuditTargetType;
  targetId?: string;
  metadata?: AdminAuditMetadataInput;
  reason?: AdminAuditReason;
  requestCorrelationId?: string;
  outcome?: AdminAuditOutcome;
}>;

export type AdminAuditTransactionClient = Prisma.TransactionClient;

const actionSet: ReadonlySet<string> = new Set(ADMIN_AUDIT_ACTIONS);
const targetTypeSet: ReadonlySet<string> = new Set(
  ADMIN_AUDIT_TARGET_TYPES,
);

const reasonSet: ReadonlySet<string> = new Set([
  "ADMIN_REQUEST",
  "USER_REQUEST",
  "SECURITY_RESPONSE",
  "POLICY_ENFORCEMENT",
  "CONTENT_POLICY",
  "OTHER",
]);

const outcomeSet: ReadonlySet<string> = new Set([
  "SUCCEEDED",
  "FAILED",
  "DENIED",
]);

const authenticationMethods: ReadonlySet<string> = new Set([
  "EMAIL",
  "PHONE",
  "GOOGLE",
  "APPLE",
  "PASSKEY",
  "TOTP",
  "RECOVERY_CODE",
]);

const resourceTypes: ReadonlySet<string> = new Set([
  "PORTFOLIO",
  "PROJECT",
  "EDUCATION",
  "EXPERIENCE",
  "SKILL",
  "INSIGHT",
  "TESTIMONIAL",
  "POST",
  "SERVICE",
]);

const origins: ReadonlySet<string> = new Set([
  "MANUAL_ENTRY",
  "WEBSITE_FORM",
  "REFERRAL",
  "SOCIAL_MEDIA",
  "EVENT",
  "WALK_IN",
  "CAMPAIGN",
  "OTHER",
]);

const safeIdPattern = /^[A-Za-z0-9_-]{1,128}$/;

// Database identifiers are opaque, but standalone phone-like values are not IDs.
const phoneLikeIdPattern = /^\+?[0-9(). -]{7,}$/;

const safeTargetIdPattern = /^[A-Za-z0-9._:/-]{1,256}$/;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sensitiveTextPattern =
  /(?:\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|\+?\d[\d().\s-]{7,}\d|\b(?:bearer|password|passwd|token|secret|authorization)\b|postgres(?:ql)?:\/\/|\b(?:SELECT|INSERT|UPDATE|DELETE)\s+.+\s+FROM\b)/i;

/**
 * Only explicitly approved metadata fields can be persisted.
 *
 * storagePath is separately validated against the exact media path
 * format used by the Welcome Page media API.
 */
const allowedMetadataRules = {
  affectedUserId: "id",
  portfolioId: "id",
  sessionId: "id",
  versionId: "id",
  deviceLabel: "text",
  revokedCount: "count",
  emailVerified: "boolean",
  phoneVerified: "boolean",
  authenticationMethod: "authenticationMethod",
  resourceType: "resourceType",
  origin: "origin",
  changedFields: "changedFields",
  publishedAt: "timestamp",
  resultCode: "resultCode",
  actionReason: "actionReason",
  storagePath: "storagePath",
} as const;

type AllowedMetadataKey = keyof typeof allowedMetadataRules;

type AuditJsonObject = Record<
  string,
  string | number | boolean | string[]
>;

const trustedActors = new WeakSet<object>();
const trustedActorUserIds = new WeakMap<object, string>();

const trustedSecurityActors = new WeakSet<object>();
const trustedSecurityActorUserIds = new WeakMap<object, string>();

const mfaSecurityActionSet: ReadonlySet<string> = new Set(
  MFA_SECURITY_AUDIT_ACTIONS,
);

export function isAdminAuditAction(
  value: unknown,
): value is AdminAuditAction {
  return typeof value === "string" && actionSet.has(value);
}

function createTrustedActor(userId: string): TrustedAdminAuditActor {
  const actor = Object.freeze({
    userId,
    role: "SUPER_ADMIN" as const,
  }) as TrustedAdminAuditActor;

  trustedActors.add(actor);
  trustedActorUserIds.set(actor, userId);

  return actor;
}

function createTrustedSecurityActor(
  userId: string,
  role: "USER" | "SUPER_ADMIN",
): TrustedSecurityAuditActor {
  const actor = Object.freeze({
    userId,
    role,
  }) as TrustedSecurityAuditActor;

  trustedSecurityActors.add(actor);
  trustedSecurityActorUserIds.set(actor, userId);

  return actor;
}

/** Resolves actor identity and role from the current server-verified session. */
export async function resolveAdminAuditActor(): Promise<TrustedAdminAuditActor> {
  const user = await getCurrentUser();

  if (
    !user ||
    user.role !== "SUPER_ADMIN" ||
    !safeIdPattern.test(user.id)
  ) {
    throw new Error("Administrative audit authorization required.");
  }

  return createTrustedActor(user.id);
}

/** Resolves a self-service security actor from the active signed server session. */
export async function resolveSecurityAuditActor(): Promise<TrustedSecurityAuditActor> {
  const user = await getCurrentUser();

  if (
    !user ||
    (user.role !== "USER" && user.role !== "SUPER_ADMIN") ||
    !safeIdPattern.test(user.id)
  ) {
    throw new Error("Authenticated security audit actor required.");
  }

  return createTrustedSecurityActor(user.id, user.role);
}

/** Resolves a pre-session MFA actor only from a challenge decoded from trusted Redis state. */
export async function resolveMfaChallengeSecurityActor(
  challenge: PendingMfaChallenge,
): Promise<TrustedSecurityAuditActor> {
  if (
    !isTrustedPendingMfaChallenge(challenge) ||
    challenge.expiresAt <= Date.now()
  ) {
    throw new Error("Verified MFA challenge audit context required.");
  }

  const user = await prisma.user.findUnique({
    where: { id: challenge.userId },
    select: { id: true, role: true },
  });

  if (
    !user ||
    (user.role !== "USER" && user.role !== "SUPER_ADMIN") ||
    !safeIdPattern.test(user.id)
  ) {
    throw new Error("Authenticated security audit actor required.");
  }

  return createTrustedSecurityActor(user.id, user.role);
}

function requireTrustedActor(
  actor: unknown,
): asserts actor is TrustedAdminAuditActor {
  if (
    !actor ||
    typeof actor !== "object" ||
    !trustedActors.has(actor)
  ) {
    throw new TypeError(
      "A server-verified administrative actor is required.",
    );
  }
}

/**
 * JavaScript cannot reliably identify proxies. Reflection may run proxy traps,
 * so trap failures reject the input and persisted values come only from this
 * single descriptor snapshot; the original object is never reread.
 */
function snapshotPlainDataObject(
  input: unknown,
  allowedKeys: readonly string[],
  label: string,
): Record<string, unknown> {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new TypeError(`${label} must be a plain data object.`);
  }

  try {
    const prototype = Object.getPrototypeOf(input);

    if (
      prototype !== Object.prototype &&
      prototype !== null
    ) {
      throw new TypeError(`${label} must be a plain data object.`);
    }

    const keys = Reflect.ownKeys(input);
    const snapshot: Record<string, unknown> = Object.create(null);

    for (const key of keys) {
      if (
        typeof key !== "string" ||
        !allowedKeys.includes(key)
      ) {
        throw new TypeError(`${label} contains unsupported fields.`);
      }

      const descriptor = Object.getOwnPropertyDescriptor(input, key);

      if (
        !descriptor ||
        !Object.hasOwn(descriptor, "value") ||
        !descriptor.enumerable
      ) {
        throw new TypeError(
          `${label} must not contain accessor or hidden properties.`,
        );
      }

      snapshot[key] = descriptor.value;
    }

    return snapshot;
  } catch (error) {
    if (error instanceof TypeError) throw error;

    throw new TypeError(
      `${label} could not be safely inspected.`,
    );
  }
}

function snapshotStringArray(value: unknown): string[] | null {
  try {
    if (
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) {
      return null;
    }

    const lengthDescriptor = Object.getOwnPropertyDescriptor(
      value,
      "length",
    );

    const length = lengthDescriptor?.value;

    if (
      !Number.isSafeInteger(length) ||
      (length as number) < 0 ||
      (length as number) > 32
    ) {
      return null;
    }

    const keys = Reflect.ownKeys(value);

    if (
      keys.length !== (length as number) + 1 ||
      !keys.includes("length")
    ) {
      return null;
    }

    const snapshot: string[] = [];

    for (
      let index = 0;
      index < (length as number);
      index += 1
    ) {
      const key = String(index);

      if (!keys.includes(key)) return null;

      const descriptor = Object.getOwnPropertyDescriptor(
        value,
        key,
      );

      if (
        !descriptor ||
        !Object.hasOwn(descriptor, "value") ||
        !descriptor.enumerable
      ) {
        return null;
      }

      if (
        typeof descriptor.value !== "string" ||
        !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(descriptor.value)
      ) {
        return null;
      }

      snapshot.push(descriptor.value);
    }

    return snapshot;
  } catch {
    return null;
  }
}

function validateTargetId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    safeTargetIdPattern.test(value) &&
    !sensitiveTextPattern.test(value)
  );
}

function validateMetadataId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    safeIdPattern.test(value) &&
    !phoneLikeIdPattern.test(value)
  );
}

function safeDeviceLabel(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 200
  ) {
    throw new TypeError("Invalid device label metadata.");
  }

  return sensitiveTextPattern.test(value)
    ? "[REDACTED]"
    : value;
}

/**
 * Validates a Welcome Page Supabase Storage path.
 *
 * This intentionally does not apply sensitiveTextPattern:
 * numeric timestamps in generated filenames are valid.
 */
function validateStoragePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 256 &&
    /^(images|videos)\/[A-Za-z0-9-]+\.(jpg|png|webp|avif|gif|mp4|webm)$/.test(
      value,
    )
  );
}

function validateMetadata(input: unknown): AuditJsonObject {
  if (input === undefined) return {};

  const source = snapshotPlainDataObject(
    input,
    Object.keys(allowedMetadataRules),
    "Audit metadata",
  );

  const keys = Object.keys(source);

  if (keys.length > 24) {
    throw new TypeError("Audit metadata contains unsupported fields.");
  }

  const output: AuditJsonObject = {};

  for (const key of keys) {
    const rule = allowedMetadataRules[key as AllowedMetadataKey];
    const value = source[key];

    switch (rule) {
      case "id":
        if (!validateMetadataId(value)) {
          throw new TypeError(`Invalid ${key} audit metadata.`);
        }
        output[key] = value;
        break;

      case "text":
        output[key] = safeDeviceLabel(value);
        break;

      case "actionReason":
        if (
          typeof value !== "string" ||
          value.trim().length < 6 ||
          value.length > 500 ||
          sensitiveTextPattern.test(value)
        ) {
          throw new TypeError(
            "Invalid administrative action reason.",
          );
        }
        output[key] = value.trim();
        break;

      case "count":
        if (
          !Number.isSafeInteger(value) ||
          (value as number) < 0
        ) {
          throw new TypeError(
            `Invalid ${key} audit metadata.`,
          );
        }
        output[key] = value as number;
        break;

      case "boolean":
        if (typeof value !== "boolean") {
          throw new TypeError(
            `Invalid ${key} audit metadata.`,
          );
        }
        output[key] = value;
        break;

      case "authenticationMethod":
        if (
          typeof value !== "string" ||
          !authenticationMethods.has(value)
        ) {
          throw new TypeError(
            "Invalid authentication method metadata.",
          );
        }
        output[key] = value;
        break;

      case "resourceType":
        if (
          typeof value !== "string" ||
          !resourceTypes.has(value)
        ) {
          throw new TypeError(
            "Invalid resource type metadata.",
          );
        }
        output[key] = value;
        break;

      case "origin":
        if (
          typeof value !== "string" ||
          !origins.has(value)
        ) {
          throw new TypeError("Invalid origin metadata.");
        }
        output[key] = value;
        break;

      case "changedFields": {
        const fields = snapshotStringArray(value);

        if (!fields) {
          throw new TypeError(
            "Invalid changed-fields metadata.",
          );
        }

        output[key] = fields;
        break;
      }

      case "timestamp":
        if (
          typeof value !== "string" ||
          value.length > 40 ||
          !Number.isFinite(Date.parse(value))
        ) {
          throw new TypeError(
            "Invalid timestamp metadata.",
          );
        }
        output[key] = value;
        break;

      case "resultCode":
        if (
          typeof value !== "string" ||
          !/^[A-Z][A-Z0-9_]{0,63}$/.test(value)
        ) {
          throw new TypeError(
            "Invalid result-code metadata.",
          );
        }
        output[key] = value;
        break;

      case "storagePath":
        if (!validateStoragePath(value)) {
          throw new TypeError(
            "Invalid storage path audit metadata.",
          );
        }
        output[key] = value;
        break;

      default:
        throw new TypeError("Unsupported audit metadata.");
    }
  }

  const serialized = JSON.stringify(output);

  if (
    new TextEncoder().encode(serialized).byteLength > 4_096
  ) {
    throw new TypeError(
      "Audit metadata exceeds the size limit.",
    );
  }

  return output;
}

function validateInput(
  input: unknown,
  allowMfaSecurityAction = false,
): AdminAuditWriteInput {
  const allowedKeys = [
    "action",
    "targetType",
    "targetId",
    "metadata",
    "reason",
    "requestCorrelationId",
    "outcome",
  ] as const;

  const value = snapshotPlainDataObject(
    input,
    allowedKeys,
    "Administrative audit input",
  );

  if (!isAdminAuditAction(value.action)) {
    throw new TypeError(
      "Unsupported administrative audit action or fields.",
    );
  }

  if (
    value.action === "SUPER_ADMIN_UNVERIFIED_AUTHENTICATION"
  ) {
    throw new TypeError(
      "Login-exemption audits must use the dedicated authentication helper.",
    );
  }

  if (
    mfaSecurityActionSet.has(value.action) &&
    !allowMfaSecurityAction
  ) {
    throw new TypeError(
      "Authentication security audits must use the trusted security writer.",
    );
  }

  if (
    value.targetType !== undefined &&
    (
      typeof value.targetType !== "string" ||
      !targetTypeSet.has(value.targetType)
    )
  ) {
    throw new TypeError(
      "Unsupported administrative audit target type.",
    );
  }

  if (
    value.targetId !== undefined &&
    !validateTargetId(value.targetId)
  ) {
    throw new TypeError(
      "Invalid administrative audit target ID.",
    );
  }

  if (
    value.reason !== undefined &&
    (
      typeof value.reason !== "string" ||
      !reasonSet.has(value.reason)
    )
  ) {
    throw new TypeError(
      "Unsupported administrative audit reason.",
    );
  }

  if (
    value.requestCorrelationId !== undefined &&
    (
      typeof value.requestCorrelationId !== "string" ||
      !uuidPattern.test(value.requestCorrelationId)
    )
  ) {
    throw new TypeError(
      "Invalid request correlation ID.",
    );
  }

  if (
    value.outcome !== undefined &&
    (
      typeof value.outcome !== "string" ||
      !outcomeSet.has(value.outcome)
    )
  ) {
    throw new TypeError(
      "Unsupported administrative audit outcome.",
    );
  }

  return {
    action: value.action,
    ...(value.targetType === undefined
      ? {}
      : {
          targetType:
            value.targetType as AdminAuditTargetType,
        }),
    ...(value.targetId === undefined
      ? {}
      : {
          targetId: value.targetId as string,
        }),
    metadata: validateMetadata(value.metadata),
    ...(value.reason === undefined
      ? {}
      : {
          reason: value.reason as AdminAuditReason,
        }),
    ...(value.requestCorrelationId === undefined
      ? {}
      : {
          requestCorrelationId:
            value.requestCorrelationId as string,
        }),
    ...(value.outcome === undefined
      ? {}
      : {
          outcome: value.outcome as AdminAuditOutcome,
        }),
  };
}

async function persistAuditRecord(
  actorUserId: string,
  validInput: AdminAuditWriteInput,
  transaction?: AdminAuditTransactionClient,
): Promise<{ eventId: string }> {
  const metadata: AuditJsonObject = {
    ...(validInput.metadata as AuditJsonObject),
    ...(validInput.reason
      ? { reason: validInput.reason }
      : {}),
    ...(validInput.requestCorrelationId
      ? {
          requestCorrelationId:
            validInput.requestCorrelationId,
        }
      : {}),
    ...(validInput.outcome
      ? { outcome: validInput.outcome }
      : {}),
  };

  if (
    new TextEncoder().encode(JSON.stringify(metadata))
      .byteLength > 4_096
  ) {
    throw new TypeError(
      "Administrative audit record exceeds the size limit.",
    );
  }

  const eventId = randomUUID();

  const client: Pick<
    Prisma.TransactionClient,
    "auditLog"
  > = transaction ?? prisma;

  await client.auditLog.create({
    data: {
      eventId,
      actorUserId,
      action: validInput.action,
      targetType: validInput.targetType ?? null,
      targetId: validInput.targetId ?? null,
      metadata,
    },
  });

  return { eventId };
}

/** Writes to the supplied Prisma transaction when present; failures propagate so callers can roll back. */
export async function writeAdminAudit(
  actor: TrustedAdminAuditActor,
  input: AdminAuditWriteInput,
  transaction?: AdminAuditTransactionClient,
): Promise<{ eventId: string }> {
  requireTrustedActor(actor);

  return persistAuditRecord(
    trustedActorUserIds.get(actor)!,
    validateInput(input),
    transaction,
  );
}

/** Self-service authentication security events share the same AuditLog table and validation pipeline. */
export async function writeSecurityAudit(
  actor: TrustedSecurityAuditActor,
  input: AdminAuditWriteInput,
  transaction?: AdminAuditTransactionClient,
): Promise<{ eventId: string }> {
  if (
    !actor ||
    typeof actor !== "object" ||
    !trustedSecurityActors.has(actor)
  ) {
    throw new TypeError(
      "A server-verified security actor is required.",
    );
  }

  const validInput = validateInput(input, true);

  if (!mfaSecurityActionSet.has(validInput.action)) {
    throw new TypeError(
      "Unsupported authentication security audit action.",
    );
  }

  return persistAuditRecord(
    trustedSecurityActorUserIds.get(actor)!,
    validInput,
    transaction,
  );
}
