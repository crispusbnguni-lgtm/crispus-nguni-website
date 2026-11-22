import { parsePhoneNumberFromString } from "libphonenumber-js";

export type PhoneOtpIntent = "signup" | "signin";

export type PhoneOtpChallenge = {
  intent: PhoneOtpIntent;
  phone: string;
  eligible: boolean;
  createdAt: number;
  name?: string;
};

export const PHONE_OTP_TTL_SECONDS = 5 * 60;

export function normalizePhoneNumber(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length > 40) return null;
  const parsed = parsePhoneNumberFromString(value.trim());
  return parsed?.isValid() && !parsed.ext ? parsed.number : null;
}

export function isValidPhoneOtpCode(value: unknown): value is string {
  return typeof value === "string" && /^\d{4,10}$/.test(value);
}

export function isPhoneChallengeFresh(
  challenge: PhoneOtpChallenge,
  now = Date.now(),
): boolean {
  return (
    Number.isFinite(challenge.createdAt) &&
    challenge.createdAt <= now &&
    now - challenge.createdAt <= PHONE_OTP_TTL_SECONDS * 1000
  );
}

export function isPhoneEligibleForIntent(
  intent: PhoneOtpIntent,
  identityExists: boolean,
): boolean {
  return intent === "signup" ? !identityExists : identityExists;
}

export type PhoneOtpVerificationResult =
  | "verified"
  | "conflict"
  | "invalid"
  | "expired"
  | "ineligible"
  | "replayed";

export async function verifyPhoneOtpChallenge({
  challenge,
  intent,
  code,
  verifyCode,
  consume,
  complete,
  now,
}: {
  challenge: PhoneOtpChallenge | null;
  intent: PhoneOtpIntent;
  code: string;
  verifyCode: (phone: string, code: string) => Promise<boolean>;
  consume: (intent: PhoneOtpIntent) => Promise<PhoneOtpChallenge | null>;
  complete: (challenge: PhoneOtpChallenge) => Promise<boolean>;
  now?: number;
}): Promise<PhoneOtpVerificationResult> {
  if (
    !challenge ||
    challenge.intent !== intent ||
    !isPhoneChallengeFresh(challenge, now)
  ) {
    return "expired";
  }

  if (!challenge.eligible) {
    await consume(intent);
    return "ineligible";
  }

  if (!isValidPhoneOtpCode(code) || !(await verifyCode(challenge.phone, code))) {
    return "invalid";
  }

  const consumed = await consume(intent);
  if (
    !consumed ||
    consumed.phone !== challenge.phone ||
    consumed.createdAt !== challenge.createdAt
  ) {
    return "replayed";
  }

  return (await complete(consumed)) ? "verified" : "conflict";
}

export function phoneOtpRateLimitExceeded(
  results: ReadonlyArray<{ success: boolean }>,
): boolean {
  return results.some((result) => !result.success);
}
