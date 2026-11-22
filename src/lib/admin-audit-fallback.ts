import "server-only";

import { randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";

export const ADMIN_AUDIT_WRITE_FAILURE = "ADMIN_AUDIT_WRITE_FAILURE" as const;
export const SUPER_ADMIN_VERIFICATION_AUDIT_ACTION =
  "SUPER_ADMIN_UNVERIFIED_AUTHENTICATION" as const;

export type AdminAuditAuthenticationMethod = "EMAIL" | "PHONE" | "GOOGLE";
export type AdminAuditErrorClassification =
  | "DATABASE_UNAVAILABLE"
  | "TIMEOUT"
  | "CONSTRAINT_FAILURE"
  | "UNKNOWN";

export type TrustedAdminAuditActor = Readonly<{
  userId: string;
  role: "SUPER_ADMIN";
  authenticationMethod: AdminAuditAuthenticationMethod;
}>;

export type AdminAuditWriteFailureEvent = Readonly<{
  eventType: typeof ADMIN_AUDIT_WRITE_FAILURE;
  eventId: string;
  correlationId: string;
  occurredAt: string;
  userId: string;
  role: "SUPER_ADMIN";
  originalAction: typeof SUPER_ADMIN_VERIFICATION_AUDIT_ACTION;
  authenticationMethod: AdminAuditAuthenticationMethod;
  errorClassification: AdminAuditErrorClassification;
}>;

export type AdminAuditFallbackDiagnostic = Readonly<{
  eventType: typeof ADMIN_AUDIT_WRITE_FAILURE;
  eventId: string | null;
  correlationId: string | null;
  errorClassification: AdminAuditErrorClassification;
  fallbackOutcome: "unconfirmed";
  reason: "INVALID_INPUT" | "SINK_UNAVAILABLE" | "SINK_FAILURE" | "INVALID_ACKNOWLEDGEMENT";
}>;

export type AdminAuditFallbackSink = {
  append(event: AdminAuditWriteFailureEvent): Promise<unknown>;
};

export type AdminAuditFallbackResult =
  | {
      status: "fallback_accepted";
      eventId: string;
      correlationId: string;
      receiptId: string;
      alertOutcome: "not_attempted";
      diagnosticOutcome: "not_attempted";
    }
  | {
      status: "unconfirmed";
      eventId: string | null;
      correlationId: string | null;
      errorClassification: AdminAuditErrorClassification;
      alertOutcome: "not_configured" | "accepted" | "failed";
      diagnosticOutcome: "emitted" | "failed";
    };

export type AdminAuditFallbackDependencies = {
  sink: AdminAuditFallbackSink | null;
  alert?: (diagnostic: AdminAuditFallbackDiagnostic) => Promise<unknown>;
  diagnostic?: (diagnostic: AdminAuditFallbackDiagnostic) => void | Promise<void>;
  now?: () => Date;
  createEventId?: () => string;
  timeouts?: AdminAuditFallbackTimeouts;
};

export type AdminAuditFallbackInput = Readonly<{
  actor: TrustedAdminAuditActor;
  primaryError: unknown;
  /** Supplied only by trusted server-side code when sharing an ID with the primary audit. */
  eventId?: string;
}>;

export type AdminAuditFallbackTimeouts = Readonly<{
  sinkMs?: number;
  alertMs?: number;
  diagnosticMs?: number;
}>;

const STREAM_KEY = "security:admin-audit-fallback:v1";
const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const STREAM_ID_PATTERN = /^\d+-\d+$/;
const DEFAULT_TIMEOUTS = { sinkMs: 1_500, alertMs: 500, diagnosticMs: 250 } as const;
const MAX_TIMEOUTS = { sinkMs: 5_000, alertMs: 2_000, diagnosticMs: 1_000 } as const;
const PHONE_LIKE_ID_PATTERN = /^\+?[0-9(). -]{7,}$/;
const AUTH_METHODS = new Set<AdminAuditAuthenticationMethod>([
  "EMAIL",
  "PHONE",
  "GOOGLE",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => keys.includes(key));
}

function isTrustedActor(value: unknown): value is TrustedAdminAuditActor {
  if (!isRecord(value) || !hasExactKeys(value, ["userId", "role", "authenticationMethod"])) {
    return false;
  }

  return (
    typeof value.userId === "string" &&
    USER_ID_PATTERN.test(value.userId) &&
    !PHONE_LIKE_ID_PATTERN.test(value.userId) &&
    !value.userId.includes("@") &&
    value.role === "SUPER_ADMIN" &&
    typeof value.authenticationMethod === "string" &&
    AUTH_METHODS.has(value.authenticationMethod as AdminAuditAuthenticationMethod)
  );
}

function readErrorProperty(error: unknown, property: "code"): unknown {
  if (!isRecord(error)) return undefined;
  try {
    return error[property];
  } catch {
    return undefined;
  }
}

/** Converts known driver codes to fixed labels; raw error data is never returned. */
export function classifyAdminAuditWriteError(
  error: unknown,
): AdminAuditErrorClassification {
  const code = readErrorProperty(error, "code");

  switch (code) {
    case "P1001":
    case "P1002":
    case "P1017":
    case "ECONNREFUSED":
    case "ECONNRESET":
    case "ENOTFOUND":
      return "DATABASE_UNAVAILABLE";
    case "P1008":
    case "P2024":
    case "ETIMEDOUT":
      return "TIMEOUT";
    case "P2002":
    case "P2003":
      return "CONSTRAINT_FAILURE";
    default:
      return "UNKNOWN";
  }
}

function validEventId(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function validAcknowledgement(value: unknown): value is string {
  return typeof value === "string" && STREAM_ID_PATTERN.test(value);
}

function boundedTimeout(value: unknown, fallback: number, maximum: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.min(Math.floor(value), maximum)
    : fallback;
}

type TimedResult<T> =
  | { completed: true; value: T }
  | { completed: false };

/** Settles once and observes late rejections after the timeout has returned. */
function settleWithin<T>(
  operation: () => T | PromiseLike<T>,
  timeoutMs: number,
): Promise<TimedResult<T>> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ completed: false });
    }, timeoutMs);

    Promise.resolve()
      .then(operation)
      .then(
        (value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({ completed: true, value });
        },
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({ completed: false });
        },
      );
  });
}

function makeDiagnostic(
  eventId: string | null,
  errorClassification: AdminAuditErrorClassification,
  reason: AdminAuditFallbackDiagnostic["reason"],
): AdminAuditFallbackDiagnostic {
  return {
    eventType: ADMIN_AUDIT_WRITE_FAILURE,
    eventId,
    correlationId: eventId,
    errorClassification,
    fallbackOutcome: "unconfirmed",
    reason,
  };
}

function makeConfiguredSink(): AdminAuditFallbackSink | null {
  const url = process.env.UPSTASH_AUDIT_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_AUDIT_REDIS_REST_TOKEN?.trim();

  if (!url || !token) return null;

  try {
    const redis = new Redis({ url, token });
    return {
      async append(event) {
        const fields: Record<string, string> = {
          eventType: event.eventType,
          eventId: event.eventId,
          correlationId: event.correlationId,
          occurredAt: event.occurredAt,
          userId: event.userId,
          role: event.role,
          originalAction: event.originalAction,
          authenticationMethod: event.authenticationMethod,
          errorClassification: event.errorClassification,
        };

        return redis.xadd(STREAM_KEY, "*", fields);
      },
    };
  } catch {
    return null;
  }
}

export function createAdminAuditFallbackService(
  dependencies: AdminAuditFallbackDependencies,
) {
  const now = dependencies.now ?? (() => new Date());
  const createEventId = dependencies.createEventId ?? randomUUID;
  const timeouts = {
    sinkMs: boundedTimeout(dependencies.timeouts?.sinkMs, DEFAULT_TIMEOUTS.sinkMs, MAX_TIMEOUTS.sinkMs),
    alertMs: boundedTimeout(dependencies.timeouts?.alertMs, DEFAULT_TIMEOUTS.alertMs, MAX_TIMEOUTS.alertMs),
    diagnosticMs: boundedTimeout(
      dependencies.timeouts?.diagnosticMs,
      DEFAULT_TIMEOUTS.diagnosticMs,
      MAX_TIMEOUTS.diagnosticMs,
    ),
  };
  const diagnostic = dependencies.diagnostic ?? ((entry) => {
    console.error("ADMIN_AUDIT_FALLBACK_UNCONFIRMED", entry);
  });

  async function reportUnconfirmed(
    diagnosticEntry: AdminAuditFallbackDiagnostic,
  ): Promise<AdminAuditFallbackResult> {
    let alertOutcome: "not_configured" | "accepted" | "failed" = "not_configured";
    if (dependencies.alert) {
      const alertResult = await settleWithin(
        () => dependencies.alert!(diagnosticEntry),
        timeouts.alertMs,
      );
      alertOutcome = alertResult.completed && alertResult.value === true
        ? "accepted"
        : "failed";
    }

    const diagnosticResult = await settleWithin(
      () => diagnostic(diagnosticEntry),
      timeouts.diagnosticMs,
    );
    const diagnosticOutcome: "emitted" | "failed" = diagnosticResult.completed
      ? "emitted"
      : "failed";

    return {
      status: "unconfirmed",
      eventId: diagnosticEntry.eventId,
      correlationId: diagnosticEntry.correlationId,
      errorClassification: diagnosticEntry.errorClassification,
      alertOutcome,
      diagnosticOutcome,
    };
  }

  async function record(
    input: AdminAuditFallbackInput,
  ): Promise<AdminAuditFallbackResult> {
    let errorClassification: AdminAuditErrorClassification = "UNKNOWN";
    let eventId: string | null = null;

    try {
      if (
        !isRecord(input) ||
        !["actor", "primaryError"].every((key) => Object.hasOwn(input, key)) ||
        Object.keys(input).some((key) => !["actor", "primaryError", "eventId"].includes(key)) ||
        !isTrustedActor(input.actor)
      ) {
        return await reportUnconfirmed(
          makeDiagnostic(null, "UNKNOWN", "INVALID_INPUT"),
        );
      }

      errorClassification = classifyAdminAuditWriteError(input.primaryError);
      const generatedId = Object.hasOwn(input, "eventId") ? input.eventId : createEventId();
      if (!validEventId(generatedId)) {
        return await reportUnconfirmed(
          makeDiagnostic(null, errorClassification, "INVALID_INPUT"),
        );
      }
      eventId = generatedId;

      let occurredAt: string;
      try {
        const timestamp = now();
        if (!(timestamp instanceof Date) || !Number.isFinite(timestamp.getTime())) {
          throw new TypeError("Invalid clock value.");
        }
        occurredAt = timestamp.toISOString();
      } catch {
        return await reportUnconfirmed(
          makeDiagnostic(eventId, errorClassification, "INVALID_INPUT"),
        );
      }

      const event: AdminAuditWriteFailureEvent = {
        eventType: ADMIN_AUDIT_WRITE_FAILURE,
        eventId,
        correlationId: eventId,
        occurredAt,
        userId: input.actor.userId,
        role: input.actor.role,
        originalAction: SUPER_ADMIN_VERIFICATION_AUDIT_ACTION,
        authenticationMethod: input.actor.authenticationMethod,
        errorClassification,
      };

      if (!dependencies.sink) {
        return await reportUnconfirmed(
          makeDiagnostic(eventId, errorClassification, "SINK_UNAVAILABLE"),
        );
      }

      const sinkResult = await settleWithin(
        () => dependencies.sink!.append(event),
        timeouts.sinkMs,
      );
      if (!sinkResult.completed) {
        return await reportUnconfirmed(
          makeDiagnostic(eventId, errorClassification, "SINK_FAILURE"),
        );
      }
      const acknowledgement = sinkResult.value;

      if (!validAcknowledgement(acknowledgement)) {
        return await reportUnconfirmed(
          makeDiagnostic(eventId, errorClassification, "INVALID_ACKNOWLEDGEMENT"),
        );
      }

      return {
        status: "fallback_accepted",
        eventId,
        correlationId: eventId,
        receiptId: acknowledgement,
        alertOutcome: "not_attempted",
        diagnosticOutcome: "not_attempted",
      };
    } catch {
      return await reportUnconfirmed(
        makeDiagnostic(eventId, errorClassification, "SINK_FAILURE"),
      );
    }
  }

  return { record };
}

const configuredService = createAdminAuditFallbackService({
  sink: makeConfiguredSink(),
});

/** Never throws: callers may continue valid authentication on any fallback failure. */
export async function recordAdminAuditWriteFailure(
  input: AdminAuditFallbackInput,
): Promise<AdminAuditFallbackResult> {
  try {
    return await configuredService.record(input);
  } catch {
    return {
      status: "unconfirmed",
      eventId: null,
      correlationId: null,
      errorClassification: "UNKNOWN",
      alertOutcome: "not_configured",
      diagnosticOutcome: "failed",
    };
  }
}
