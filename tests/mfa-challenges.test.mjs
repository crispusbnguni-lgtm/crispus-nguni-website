import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: dataModule(""), shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const {
  createMfaChallengeService,
  MFA_CHALLENGE_TTL_SECONDS,
} = await import("../src/lib/mfa-challenges-core.ts");

class MockChallengeStore {
  entries = new Map();
  lastSetOptions = null;
  fail = false;
  setResult = "OK";
  attempts = new Map();

  async set(key, value, options) {
    if (this.fail) throw new Error("mock storage failure");
    this.lastSetOptions = options;
    if (options.nx && this.entries.has(key)) return null;
    if (this.setResult !== "OK") return this.setResult;
    this.entries.set(key, value);
    return "OK";
  }

  async get(key) {
    if (this.fail) throw new Error("mock storage failure");
    return this.entries.get(key) ?? null;
  }

  async getdel(key) {
    if (this.fail) throw new Error("mock storage failure");
    const value = this.entries.get(key) ?? null;
    this.entries.delete(key);
    return value;
  }

  async del(key) {
    if (this.fail) throw new Error("mock storage failure");
    this.entries.delete(key);
  }

  async recordFailedAttempt(challengeKey, attemptsKey, _ttl, maxAttempts) {
    if (this.fail) throw new Error("mock storage failure");
    if (!this.entries.has(challengeKey)) return -1;
    const count = (this.attempts.get(attemptsKey) ?? 0) + 1;
    this.attempts.set(attemptsKey, count);
    if (count >= maxAttempts) {
      this.entries.delete(challengeKey);
      this.attempts.delete(attemptsKey);
      return 0;
    }
    return maxAttempts - count;
  }
}

const fixedNow = 1_800_000_000_000;

function makeService(store, now = () => fixedNow) {
  return createMfaChallengeService(store, now);
}

function challengeKey(token) {
  const digest = createHash("sha256").update(token, "utf8").digest("hex");
  return `auth:mfa:pending:${digest}`;
}

async function createChallenge(service, overrides = {}) {
  return service.createPendingMfaChallenge({
    userId: "verified-user-123",
    primaryAuthMethod: "EMAIL",
    ...overrides,
  });
}

test("creates a random opaque challenge with an explicit five-minute Redis TTL", async () => {
  const store = new MockChallengeStore();
  const service = makeService(store);

  const first = await createChallenge(service);
  const second = await createChallenge(service);

  assert.match(first.token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first.token, second.token);
  assert.equal(first.expiresAt, fixedNow + MFA_CHALLENGE_TTL_SECONDS * 1000);
  assert.deepEqual(store.lastSetOptions, {
    ex: MFA_CHALLENGE_TTL_SECONDS,
    nx: true,
  });
});

test("uses only a SHA-256 digest of the raw token as the Redis key", async () => {
  const store = new MockChallengeStore();
  const created = await createChallenge(makeService(store));
  const [storedKey] = store.entries.keys();

  assert.equal(storedKey, challengeKey(created.token));
  assert.match(storedKey, /^auth:mfa:pending:[a-f0-9]{64}$/);
  assert.equal(storedKey.includes(created.token), false);
});

test("retrieves the original server-side user, method, purpose and primary event binding", async () => {
  const store = new MockChallengeStore();
  const service = makeService(store);
  const created = await createChallenge(service, {
    userId: "user-from-verified-database-result",
    primaryAuthMethod: "PASSKEY",
  });

  const pending = await service.getPendingMfaChallenge(created.token);
  assert.deepEqual({
    userId: pending?.userId,
    primaryAuthMethod: pending?.primaryAuthMethod,
    purpose: pending?.purpose,
    expiresAt: pending?.expiresAt,
  }, {
    userId: "user-from-verified-database-result",
    primaryAuthMethod: "PASSKEY",
    purpose: "LOGIN",
    expiresAt: created.expiresAt,
  });
  assert.match(pending?.primaryAuthenticationEventId ?? "", /^[0-9a-f-]{36}$/i);
});

test("consumes a challenge once and rejects a second consumption", async () => {
  const service = makeService(new MockChallengeStore());
  const created = await createChallenge(service, {
    primaryAuthMethod: "GOOGLE",
  });

  const consumed = await service.consumePendingMfaChallenge(created.token);
  assert.deepEqual({
    userId: consumed?.userId,
    primaryAuthMethod: consumed?.primaryAuthMethod,
    purpose: consumed?.purpose,
    expiresAt: consumed?.expiresAt,
  }, {
    userId: "verified-user-123",
    primaryAuthMethod: "GOOGLE",
    purpose: "LOGIN",
    expiresAt: created.expiresAt,
  });
  assert.equal(await service.consumePendingMfaChallenge(created.token), null);
});

test("rejects expired challenges on both lookup and consumption", async () => {
  const store = new MockChallengeStore();
  let now = fixedNow;
  const service = makeService(store, () => now);
  const created = await createChallenge(service);

  now = created.expiresAt;
  assert.equal(await service.getPendingMfaChallenge(created.token), null);
  assert.equal(await service.consumePendingMfaChallenge(created.token), null);
});

test("rejects a missing stored expiry", async () => {
  const store = new MockChallengeStore();
  const token = "A".repeat(43);
  store.entries.set(
    challengeKey(token),
    JSON.stringify({
      userId: "verified-user-123",
      primaryAuthMethod: "EMAIL",
    }),
  );
  const service = makeService(store);

  assert.equal(await service.getPendingMfaChallenge(token), null);
  assert.equal(await service.consumePendingMfaChallenge(token), null);
});

test("rejects malformed stored expiry values", async () => {
  for (const expiresAt of ["later", null, 1.5]) {
    const store = new MockChallengeStore();
    const token = "B".repeat(43);
    store.entries.set(
      challengeKey(token),
      JSON.stringify({
        userId: "verified-user-123",
        primaryAuthMethod: "EMAIL",
        expiresAt,
      }),
    );
    const service = makeService(store);

    assert.equal(await service.getPendingMfaChallenge(token), null);
    assert.equal(await service.consumePendingMfaChallenge(token), null);
  }
});

test("rejects malformed stored JSON", async () => {
  const store = new MockChallengeStore();
  const token = "C".repeat(43);
  store.entries.set(challengeKey(token), "{not valid JSON");
  const service = makeService(store);

  assert.equal(await service.getPendingMfaChallenge(token), null);
  assert.equal(await service.consumePendingMfaChallenge(token), null);
});

test("rejects challenges when the injected current clock is invalid", async () => {
  for (const invalidTime of [NaN, Infinity, -Infinity, -1, 1.5, "invalid"]) {
    const store = new MockChallengeStore();
    const created = await createChallenge(makeService(store));
    const invalidClockService = makeService(store, () => invalidTime);

    assert.equal(
      await invalidClockService.getPendingMfaChallenge(created.token),
      null,
    );
    assert.equal(
      await invalidClockService.consumePendingMfaChallenge(created.token),
      null,
    );
  }
});

test("rejects malformed and tampered challenge tokens", async () => {
  const service = makeService(new MockChallengeStore());
  const created = await createChallenge(service);
  const tampered = `${created.token.slice(0, -1)}${created.token.endsWith("A") ? "B" : "A"}`;

  assert.equal(await service.getPendingMfaChallenge("not-a-token"), null);
  assert.equal(await service.consumePendingMfaChallenge("not-a-token"), null);
  assert.equal(await service.getPendingMfaChallenge(tampered), null);
  assert.equal(await service.consumePendingMfaChallenge(tampered), null);
  assert.notEqual(await service.getPendingMfaChallenge(created.token), null);
});

test("concurrent consumption attempts have at most one winner", async () => {
  const service = makeService(new MockChallengeStore());
  const created = await createChallenge(service);

  const results = await Promise.all([
    service.consumePendingMfaChallenge(created.token),
    service.consumePendingMfaChallenge(created.token),
  ]);

  assert.equal(results.filter(Boolean).length, 1);
});

test("storage failures fail closed for create, lookup, and consume", async () => {
  const store = new MockChallengeStore();
  const service = makeService(store);
  const created = await createChallenge(service);

  store.fail = true;
  await assert.rejects(
    service.createPendingMfaChallenge({
      userId: "verified-user-123",
      primaryAuthMethod: "EMAIL",
    }),
    /Pending MFA challenge storage is unavailable/,
  );
  assert.equal(await service.getPendingMfaChallenge(created.token), null);
  assert.equal(await service.consumePendingMfaChallenge(created.token), null);

  const unavailable = makeService(null);
  await assert.rejects(
    createChallenge(unavailable),
    /Pending MFA challenge storage is unavailable/,
  );
  assert.equal(await unavailable.getPendingMfaChallenge(created.token), null);
  assert.equal(await unavailable.consumePendingMfaChallenge(created.token), null);
});

test("unsuccessful Redis SET results cannot create a reported challenge", async () => {
  for (const setResult of [null, "NOT_STORED"]) {
    const store = new MockChallengeStore();
    store.setResult = setResult;

    await assert.rejects(
      createChallenge(makeService(store)),
      /Pending MFA challenge storage is unavailable/,
    );
    assert.equal(store.entries.size, 0);
  }
});

test("rejects invalid server-side challenge bindings", async () => {
  const service = makeService(new MockChallengeStore());

  await assert.rejects(
    service.createPendingMfaChallenge({
      userId: "   ",
      primaryAuthMethod: "EMAIL",
    }),
    /verified user and primary authentication method are required/,
  );
  await assert.rejects(
    service.createPendingMfaChallenge({
      userId: "verified-user-123",
      primaryAuthMethod: "NOT_A_METHOD",
    }),
    /verified user and primary authentication method are required/,
  );
});

test("step-up challenges bind the session and MFA-state version server-side", async () => {
  const service = makeService(new MockChallengeStore());
  const created = await service.createPendingMfaChallenge({
    userId: "trusted-user",
    primaryAuthMethod: "PASSKEY",
    purpose: "STEP_UP",
    sessionId: "session_123",
    factorStateVersion: "state_abc123",
  });
  const pending = await service.getPendingMfaChallenge(created.token);

  assert.equal(pending?.purpose, "STEP_UP");
  assert.equal(pending?.sessionId, "session_123");
  assert.equal(pending?.factorStateVersion, "state_abc123");
});

test("failed-factor attempts allow retry and invalidate the challenge at the limit", async () => {
  const service = makeService(new MockChallengeStore());
  const created = await createChallenge(service);

  assert.equal(await service.recordFailedMfaAttempt(created.token), 4);
  assert.notEqual(await service.getPendingMfaChallenge(created.token), null);
  assert.equal(await service.recordFailedMfaAttempt(created.token), 3);
  assert.equal(await service.recordFailedMfaAttempt(created.token), 2);
  assert.equal(await service.recordFailedMfaAttempt(created.token), 1);
  assert.equal(await service.recordFailedMfaAttempt(created.token), 0);
  assert.equal(await service.getPendingMfaChallenge(created.token), null);
});

test("attempt storage failures fail closed", async () => {
  const store = new MockChallengeStore();
  const service = makeService(store);
  const created = await createChallenge(service);
  store.fail = true;
  assert.equal(await service.recordFailedMfaAttempt(created.token), null);
});
