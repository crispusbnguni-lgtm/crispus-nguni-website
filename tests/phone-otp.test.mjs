import test from "node:test";
import assert from "node:assert/strict";
import {
  isPhoneEligibleForIntent,
  isPhoneChallengeFresh,
  normalizePhoneNumber,
  phoneOtpRateLimitExceeded,
  verifyPhoneOtpChallenge,
} from "../src/lib/phone-otp-core.ts";

const validPhone = "+254712345678";
const now = 1_800_000_000_000;

function challenge(overrides = {}) {
  return {
    intent: "signup",
    phone: validPhone,
    eligible: true,
    createdAt: now,
    name: "A User",
    ...overrides,
  };
}

test("normalizes valid international numbers to E.164 and rejects invalid numbers", () => {
  assert.equal(normalizePhoneNumber(" +254 712 345 678 "), validPhone);
  assert.equal(normalizePhoneNumber("not a phone"), null);
  assert.equal(normalizePhoneNumber("712345678"), null);
  assert.equal(normalizePhoneNumber("+254 712 345 678 ext. 4"), null);
});

test("signup rejects an existing identity and sign-in rejects an unknown phone", () => {
  assert.equal(isPhoneEligibleForIntent("signup", true), false);
  assert.equal(isPhoneEligibleForIntent("signin", false), false);
  assert.equal(isPhoneEligibleForIntent("signup", false), true);
  assert.equal(isPhoneEligibleForIntent("signin", true), true);
});

test("invalid and expired OTP checks never complete account creation", async () => {
  let consumed = 0;
  let completed = 0;
  const result = await verifyPhoneOtpChallenge({
    challenge: challenge(),
    intent: "signup",
    code: "123456",
    now,
    verifyCode: async () => false,
    consume: async () => {
      consumed += 1;
      return challenge();
    },
    complete: async () => {
      completed += 1;
      return true;
    },
  });
  assert.equal(result, "invalid");
  assert.equal(consumed, 0);
  assert.equal(completed, 0);

  const expired = await verifyPhoneOtpChallenge({
    challenge: challenge({ createdAt: now - 6 * 60 * 1000 }),
    intent: "signup",
    code: "123456",
    now,
    verifyCode: async () => true,
    consume: async () => challenge(),
    complete: async () => true,
  });
  assert.equal(expired, "expired");
});

test("expired Twilio codes and unknown-phone challenges do not authenticate", async () => {
  let verified = 0;
  let completed = 0;
  const expiredCode = await verifyPhoneOtpChallenge({
    challenge: challenge({ intent: "signin" }),
    intent: "signin",
    code: "123456",
    now,
    verifyCode: async () => {
      verified += 1;
      return false;
    },
    consume: async () => challenge({ intent: "signin" }),
    complete: async () => {
      completed += 1;
      return true;
    },
  });
  assert.equal(expiredCode, "invalid");

  const unknownPhone = await verifyPhoneOtpChallenge({
    challenge: challenge({ intent: "signin", eligible: false }),
    intent: "signin",
    code: "123456",
    now,
    verifyCode: async () => {
      verified += 1;
      return true;
    },
    consume: async () => challenge({ intent: "signin", eligible: false }),
    complete: async () => {
      completed += 1;
      return true;
    },
  });
  assert.equal(unknownPhone, "ineligible");
  assert.equal(verified, 1);
  assert.equal(completed, 0);
});

test("replayed challenge cannot create a second account", async () => {
  let consumed = false;
  let creations = 0;
  const consume = async () => {
    if (consumed) return null;
    consumed = true;
    return challenge();
  };
  const options = {
    challenge: challenge(),
    intent: "signup",
    code: "123456",
    now,
    verifyCode: async () => true,
    consume,
    complete: async () => {
      creations += 1;
      return true;
    },
  };

  const outcomes = await Promise.all([
    verifyPhoneOtpChallenge(options),
    verifyPhoneOtpChallenge(options),
  ]);
  assert.deepEqual(outcomes.sort(), ["replayed", "verified"]);
  assert.equal(creations, 1);
});

test("a duplicate identity conflict prevents successful signup", async () => {
  const result = await verifyPhoneOtpChallenge({
    challenge: challenge(),
    intent: "signup",
    code: "123456",
    now,
    verifyCode: async () => true,
    consume: async () => challenge(),
    complete: async () => false,
  });
  assert.equal(result, "conflict");
});

test("rate limit decisions block if either IP or phone quota is exceeded", () => {
  assert.equal(phoneOtpRateLimitExceeded([{ success: true }, { success: true }]), false);
  assert.equal(phoneOtpRateLimitExceeded([{ success: false }, { success: true }]), true);
  assert.equal(phoneOtpRateLimitExceeded([{ success: true }, { success: false }]), true);
});

test("challenge freshness is limited to five minutes", () => {
  assert.equal(isPhoneChallengeFresh(challenge(), now), true);
  assert.equal(isPhoneChallengeFresh(challenge({ createdAt: now - 301_000 }), now), false);
});
