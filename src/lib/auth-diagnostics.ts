import "server-only";

import { randomUUID } from "node:crypto";

export const AUTH_DIAGNOSTIC_OPERATIONS = [
  "LOGIN_ACCOUNT_LOOKUP",
  "LOGIN_PASSWORD_VERIFY",
  "LOGIN_MFA_COMPLETION",
  "MFA_CHALLENGE_VERIFY",
  "MFA_SESSION_CREATE",
  "MFA_ENROLLMENT_SETUP",
  "MFA_ENROLLMENT_CONFIRM",
] as const;

export type AuthDiagnosticOperation = (typeof AUTH_DIAGNOSTIC_OPERATIONS)[number];

const operations = new Set<string>(AUTH_DIAGNOSTIC_OPERATIONS);
const prismaCodes = new Set(["P1000", "P1001", "P1002", "P2021", "P2022", "P2034"]);
const missingColumnNames = [
  "accountStatus",
  "accountStatusReason",
  "accountSuspendedUntil",
  "verificationStatus",
  "pendingSecretCiphertext",
  "enrollmentExpiresAt",
  "lastAcceptedStep",
  "generationId",
  "revokedAt",
  "eventId",
  "mfaVerifiedAt",
  "secondFactorMethod",
  "primaryAuthMethod",
] as const;

function safeErrorClass(error: unknown): string {
  try {
    if (!(error instanceof Error)) return "UnknownError";
    return [
      "Error",
      "TypeError",
      "RangeError",
      "PrismaClientKnownRequestError",
      "PrismaClientInitializationError",
      "RedisError",
    ].includes(error.name) ? error.name : "UnknownError";
  } catch {
    return "UnknownError";
  }
}

function prismaCode(error: unknown): string | null {
  try {
    if (!error || typeof error !== "object") return null;
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" && prismaCodes.has(code) ? code : null;
  } catch {
    return null;
  }
}

function missingColumn(error: unknown, code: string | null): string | null {
  if (code !== "P2022" || !error || typeof error !== "object") return null;
  try {
    const meta = (error as { meta?: unknown }).meta;
    if (!meta || typeof meta !== "object") return null;
    const column = (meta as { column?: unknown }).column;
    if (typeof column !== "string") return null;
    return missingColumnNames.find((name) =>
      column === name || column.endsWith(`.${name}`) || column.endsWith(`\"${name}\"`),
    ) ?? null;
  } catch {
    return null;
  }
}

/** Emits redacted server diagnostics; raw exception messages and stacks are never logged. */
export function reportAuthOperationFailure(
  operation: AuthDiagnosticOperation,
  error: unknown,
): void {
  try {
    if (!operations.has(operation)) return;
    const code = prismaCode(error);
    const column = missingColumn(error, code);
    console.error(JSON.stringify({
      level: "error",
      event: "AUTHENTICATION_OPERATION_FAILED",
      operation,
      occurredAt: new Date().toISOString(),
      correlationId: randomUUID(),
      errorClass: safeErrorClass(error),
      ...(code ? { prismaCode: code } : {}),
      ...(column ? { missingSchemaColumn: column } : {}),
    }));
  } catch {
    // Diagnostics must never change authentication behavior.
  }
}
