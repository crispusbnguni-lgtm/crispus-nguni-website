import { parsePhoneNumberFromString } from "libphonenumber-js";

export function normalizeLeadEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized || null;
}

export function normalizeLeadPhone(value: string | null | undefined) {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  const parsed = parsePhoneNumberFromString(raw);
  return parsed?.isValid() && !parsed.ext ? parsed.number : null;
}

export function leadContactMatches(
  existing: {
    email: string | null;
    emailNormalized?: string | null;
    phone: string | null;
    phoneNormalized?: string | null;
  },
  incoming: { emailNormalized: string | null; phoneNormalized: string | null },
) {
  return Boolean(
    (incoming.emailNormalized &&
      (existing.emailNormalized ?? normalizeLeadEmail(existing.email)) ===
        incoming.emailNormalized) ||
      (incoming.phoneNormalized &&
        (existing.phoneNormalized ?? normalizeLeadPhone(existing.phone)) ===
          incoming.phoneNormalized),
  );
}
