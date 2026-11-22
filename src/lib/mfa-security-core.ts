import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { generateSecret, generateURI, verify } from "otplib";

export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
export const TOTP_PAST_SKEW_STEPS = 1;
export const RECOVERY_CODE_COUNT = 10;
const ENVELOPE_VERSION_PATTERN = /^v[1-9][0-9]{0,2}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const SECRET_PATTERN = /^[A-Z2-7]{16,128}$/;

export type TotpEncryptionKeyring = Readonly<{
  currentVersion: string;
  keys: Readonly<Record<string, string>>;
}>;

export function readTotpEncryptionKeyring(
  env: Readonly<Record<string, string | undefined>> = process.env,
): TotpEncryptionKeyring {
  const currentVersion = env.MFA_TOTP_ENCRYPTION_KEY_VERSION ?? "v1";
  if (!ENVELOPE_VERSION_PATTERN.test(currentVersion)) {
    throw new Error("TOTP encryption configuration is invalid.");
  }

  const keys: Record<string, string> = {};
  for (let version = 1; version <= 32; version += 1) {
    const versionName = `v${version}`;
    const configured = env[`MFA_TOTP_ENCRYPTION_KEY_V${version}`];
    if (configured !== undefined) keys[versionName] = configured;
  }

  const currentKey = env.MFA_TOTP_ENCRYPTION_KEY;
  if (currentKey !== undefined) keys[currentVersion] = currentKey;

  validateKeyring({ currentVersion, keys });
  return Object.freeze({ currentVersion, keys: Object.freeze(keys) });
}

function decodeKey(value: unknown): Buffer {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new Error("TOTP encryption configuration is invalid.");
  }
  const key = Buffer.from(value, "base64url");
  if (key.length !== 32 || key.toString("base64url") !== value) {
    throw new Error("TOTP encryption configuration is invalid.");
  }
  return key;
}

function validateKeyring(keyring: TotpEncryptionKeyring): void {
  if (
    !keyring ||
    !ENVELOPE_VERSION_PATTERN.test(keyring.currentVersion) ||
    !keyring.keys ||
    typeof keyring.keys !== "object" ||
    !Object.hasOwn(keyring.keys, keyring.currentVersion)
  ) {
    throw new Error("TOTP encryption configuration is unavailable.");
  }

  for (const [version, key] of Object.entries(keyring.keys)) {
    if (!ENVELOPE_VERSION_PATTERN.test(version)) {
      throw new Error("TOTP encryption configuration is invalid.");
    }
    decodeKey(key);
  }
}

export function generateTotpSecret(): string {
  const secret = generateSecret({ length: 20 });
  if (!SECRET_PATTERN.test(secret)) {
    throw new Error("Unable to generate an authenticator secret.");
  }
  return secret;
}

export function createTotpProvisioningUri(secret: string, label: string): string {
  if (!SECRET_PATTERN.test(secret) || !label.trim() || label.length > 254) {
    throw new Error("Invalid authenticator enrollment details.");
  }
  return generateURI({ issuer: "Crispus Nguni", label, secret, digits: TOTP_DIGITS, period: TOTP_PERIOD_SECONDS });
}

export function encryptTotpSecret(
  secret: string,
  keyring: TotpEncryptionKeyring,
): string {
  if (!SECRET_PATTERN.test(secret)) {
    throw new Error("Invalid authenticator secret.");
  }
  validateKeyring(keyring);

  const key = decodeKey(keyring.keys[keyring.currentVersion]);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    keyring.currentVersion,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptTotpSecret(
  envelope: unknown,
  keyring: TotpEncryptionKeyring,
): string {
  validateKeyring(keyring);
  if (typeof envelope !== "string" || envelope.length > 2_048) {
    throw new Error("Stored authenticator secret is invalid.");
  }

  const parts = envelope.split(".");
  if (
    parts.length !== 4 ||
    !ENVELOPE_VERSION_PATTERN.test(parts[0]) ||
    !BASE64URL_PATTERN.test(parts[1]) ||
    !BASE64URL_PATTERN.test(parts[2]) ||
    !BASE64URL_PATTERN.test(parts[3])
  ) {
    throw new Error("Stored authenticator secret is invalid.");
  }

  const [version, ivPart, tagPart, ciphertextPart] = parts;
  const keyValue = keyring.keys[version];
  if (!keyValue) throw new Error("Stored authenticator secret uses an unavailable key version.");

  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");
  if (
    iv.length !== 12 ||
    tag.length !== 16 ||
    ciphertext.length < 1 ||
    iv.toString("base64url") !== ivPart ||
    tag.toString("base64url") !== tagPart ||
    ciphertext.toString("base64url") !== ciphertextPart
  ) {
    throw new Error("Stored authenticator secret is invalid.");
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", decodeKey(keyValue), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    if (!SECRET_PATTERN.test(plaintext)) {
      throw new Error("Stored authenticator secret is invalid.");
    }
    return plaintext;
  } catch {
    throw new Error("Stored authenticator secret could not be authenticated.");
  }
}

export async function verifyTotpCode(
  secret: string,
  token: unknown,
  nowMs: number,
  lastAcceptedStep?: bigint | null,
): Promise<number | null> {
  if (
    !SECRET_PATTERN.test(secret) ||
    typeof token !== "string" ||
    !/^\d{6}$/.test(token) ||
    !Number.isSafeInteger(nowMs) ||
    nowMs < 0
  ) {
    return null;
  }

  const currentStep = Math.floor(nowMs / (TOTP_PERIOD_SECONDS * 1000));
  if (!Number.isSafeInteger(currentStep) || currentStep < 0) return null;
  const lastStep = lastAcceptedStep === undefined || lastAcceptedStep === null
    ? -1
    : Number(lastAcceptedStep);
  if (!Number.isSafeInteger(lastStep)) return null;

  // Accept the current step or one past step. Future codes are never accepted.
  const earliestStep = Math.max(0, currentStep - TOTP_PAST_SKEW_STEPS);
  for (let step = currentStep; step >= earliestStep; step -= 1) {
    if (step <= lastStep) continue;
    const result = await verify({
      secret,
      token,
      epoch: step * TOTP_PERIOD_SECONDS,
      epochTolerance: 0,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD_SECONDS,
    });
    if (result.valid) return step;
  }

  return null;
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error("Invalid recovery-code count.");
  }
  return Array.from({ length: count }, () => {
    const raw = randomBytes(20).toString("hex").toUpperCase();
    return raw.match(/.{1,6}/g)!.join("-");
  });
}

export function normalizeRecoveryCode(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 64) return null;
  const normalized = value.replaceAll("-", "").toUpperCase();
  return /^[A-F0-9]{40}$/.test(normalized) ? normalized : null;
}
