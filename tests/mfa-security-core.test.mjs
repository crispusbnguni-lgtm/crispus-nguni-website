import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { registerHooks } from "node:module";
import { generate } from "otplib";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: dataModule(""), shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const {
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  normalizeRecoveryCode,
  readTotpEncryptionKeyring,
  verifyTotpCode,
} = await import("../src/lib/mfa-security-core.ts");

const testKey = () => randomBytes(32).toString("base64url");
const keyring = (version = "v1", keys = { v1: testKey() }) => ({ currentVersion: version, keys });

test("TOTP secrets are randomly generated and AES-GCM encrypted at rest", () => {
  const secret = generateTotpSecret();
  const keys = keyring();
  const ciphertext = encryptTotpSecret(secret, keys);
  assert.notEqual(ciphertext, secret);
  assert.match(ciphertext, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(decryptTotpSecret(ciphertext, keys), secret);
});

test("AES-GCM rejects malformed ciphertext, a modified tag, and unknown key versions", () => {
  const keys = keyring();
  const encrypted = encryptTotpSecret(generateTotpSecret(), keys);
  const [version, iv, tag, body] = encrypted.split(".");
  const changedTag = `${tag[0] === "A" ? "B" : "A"}${tag.slice(1)}`;
  assert.throws(() => decryptTotpSecret(`${version}.${iv}.${changedTag}.${body}`, keys));
  assert.throws(() => decryptTotpSecret("v99.aa.bb.cc", keys));
  assert.throws(() => decryptTotpSecret("not-an-envelope", keys));
});

test("versioned envelopes remain decryptable during key rotation", () => {
  const oldKey = testKey();
  const newKey = testKey();
  const oldKeyring = keyring("v1", { v1: oldKey });
  const newKeyring = keyring("v2", { v1: oldKey, v2: newKey });
  const secret = generateTotpSecret();
  const oldEnvelope = encryptTotpSecret(secret, oldKeyring);
  const newEnvelope = encryptTotpSecret(secret, newKeyring);
  assert.equal(decryptTotpSecret(oldEnvelope, newKeyring), secret);
  assert.equal(decryptTotpSecret(newEnvelope, newKeyring), secret);
});

test("missing or malformed encryption configuration fails closed", () => {
  assert.throws(() => readTotpEncryptionKeyring({}));
  assert.throws(() => readTotpEncryptionKeyring({ MFA_TOTP_ENCRYPTION_KEY: "short" }));
  assert.throws(() => encryptTotpSecret(generateTotpSecret(), { currentVersion: "v1", keys: {} }));
});

test("TOTP verifier accepts current and narrow past skew but rejects future, malformed and replayed codes", async () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  const rfcCode = "287082"; // RFC 6238 SHA-1 test vector at Unix second 59.
  assert.equal(await verifyTotpCode(secret, rfcCode, 59_000), 1);
  assert.equal(await verifyTotpCode(secret, rfcCode, 59_000, 1n), null);
  assert.equal(await verifyTotpCode(secret, "not-a-code", 59_000), null);
  assert.equal(await verifyTotpCode(secret, "12345", 59_000), null);

  const previousStepCode = await generate({ secret, epoch: 30, digits: 6, period: 30 });
  assert.equal(await verifyTotpCode(secret, previousStepCode, 60_000), 1);
  const futureStepCode = await generate({ secret, epoch: 90, digits: 6, period: 30 });
  assert.equal(await verifyTotpCode(secret, futureStepCode, 60_000), null);
});

test("recovery codes are high entropy, unique, normalized, and format validated", () => {
  const codes = generateRecoveryCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, codes.length);
  for (const code of codes) {
    assert.match(code, /^[A-F0-9]{6}(?:-[A-F0-9]{6}){5}-[A-F0-9]{4}$/);
    assert.match(normalizeRecoveryCode(code), /^[A-F0-9]{40}$/);
  }
  assert.equal(normalizeRecoveryCode("123456"), null);
});
