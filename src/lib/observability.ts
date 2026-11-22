import "server-only";
import { randomUUID } from "node:crypto";

export const OPERATIONAL_EVENTS = [
  "DISPLAY_STUDIO_DEFAULTS_READ_FAILED",
  "DISPLAY_STUDIO_ADMIN_READ_FAILED",
  "DISPLAY_STUDIO_ADMIN_WRITE_FAILED",
  "WELCOME_PAGE_CONTENT_READ_FAILED",
  "WELCOME_PAGE_METADATA_READ_FAILED",
  "WELCOME_BACKGROUND_READ_FAILED",
  "NOTIFICATIONS_READ_FAILED",
  "NOTIFICATIONS_UPDATE_FAILED",
  "ADMIN_STORAGE_OPERATION_FAILED",
  "LEAD_NOTIFICATION_CREATE_FAILED",
  "LEAD_EMAIL_DELIVERY_FAILED",
  "PUBLIC_LEAD_INTAKE_FAILED",
  "CONSULTATION_NOTIFICATION_CREATE_FAILED",
  "CONSULTATION_EMAIL_DELIVERY_FAILED",
  "PUBLIC_CONSULTATION_BOOKING_FAILED",
] as const;

export type OperationalEvent = (typeof OPERATIONAL_EVENTS)[number];

const eventSet: ReadonlySet<string> = new Set(OPERATIONAL_EVENTS);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safeErrorNames = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "PrismaClientKnownRequestError",
  "PrismaClientInitializationError",
  "RedisError",
  "FetchError",
  "AbortError",
]);

function classifyError(cause: unknown): string {
  if (!(cause instanceof Error)) return "UnknownError";
  try {
    const name = cause.name;
    return safeErrorNames.has(name) ? name : "UnknownError";
  } catch {
    return "UnknownError";
  }
}

/** Emits bounded operational context only; never emits exception messages or stacks. */
export function reportOperationalFailure(
  event: OperationalEvent,
  options: { cause?: unknown; correlationId?: unknown } = {},
): void {
  try {
    if (!eventSet.has(event)) return;
    const correlationId =
      typeof options.correlationId === "string" && uuidPattern.test(options.correlationId)
        ? options.correlationId
        : randomUUID();
    const record = {
      level: "error",
      event,
      occurredAt: new Date().toISOString(),
      correlationId,
      errorClass: classifyError(options.cause),
    };
    console.error(JSON.stringify(record));
  } catch {
    // Diagnostics are best-effort and must not change request behavior.
  }
}
