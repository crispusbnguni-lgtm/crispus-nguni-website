import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const data = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

const state = globalThis.__loginRateLimit = {
  calls: [],
  counts: new Map(),
  failReads: false,
  failWrites: false,
};

process.env.UPSTASH_REDIS_REST_URL = "https://mock-redis.invalid";
process.env.UPSTASH_REDIS_REST_TOKEN = "test-only-token";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") {
      return { url: data(""), shortCircuit: true };
    }
    if (specifier === "@upstash/redis") {
      return {
        url: data("export class Redis { constructor() {} }"),
        shortCircuit: true,
      };
    }
    if (specifier === "@upstash/ratelimit") {
      return {
        url: data(`
          export class Ratelimit {
            static slidingWindow(limit, duration) { return { limit, duration }; }
            constructor({ limiter, prefix }) { this.limiter = limiter; this.prefix = prefix; }
            key(identifier) { return this.prefix + ":" + identifier; }
            resetAt() {
              const [, count, unit] = this.limiter.duration.match(/^(\\d+)\\s*(s|m|h)$/);
              const factor = unit === "s" ? 1000 : unit === "m" ? 60000 : 3600000;
              return Date.now() + Number(count) * factor;
            }
            async limit(identifier) {
              globalThis.__loginRateLimit.calls.push({ operation: "limit", prefix: this.prefix, identifier });
              if (globalThis.__loginRateLimit.failWrites) throw new Error("mock write failure");
              const key = this.key(identifier);
              const count = (globalThis.__loginRateLimit.counts.get(key) ?? 0) + 1;
              globalThis.__loginRateLimit.counts.set(key, count);
              return { success: count <= this.limiter.limit, reset: this.resetAt() };
            }
            async getRemaining(identifier) {
              globalThis.__loginRateLimit.calls.push({ operation: "getRemaining", prefix: this.prefix, identifier });
              if (globalThis.__loginRateLimit.failReads) throw new Error("mock read failure");
              const count = globalThis.__loginRateLimit.counts.get(this.key(identifier)) ?? 0;
              return { remaining: Math.max(0, this.limiter.limit - count), reset: this.resetAt(), limit: this.limiter.limit };
            }
          }
        `),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/phone-otp-core") {
      return {
        url: data("export function phoneOtpRateLimitExceeded(results) { return results.some((result) => !result.success); }"),
        shortCircuit: true,
      };
    }
    return next(specifier, context);
  },
});

const { checkAuthRateLimit } = await import("../src/lib/rate-limit.ts");

function reset() {
  state.calls.length = 0;
  state.counts.clear();
  state.failReads = false;
  state.failWrites = false;
}

function loginRequest(ip = "192.0.2.10") {
  return new Request("https://example.test/api/auth/login", {
    headers: { "x-real-ip": ip },
  });
}

test("login precheck enforces IP and normalized-account windows using hashed identifiers", async () => {
  reset();
  const result = await checkAuthRateLimit({
    request: loginRequest(),
    action: "login",
    email: "Admin@Example.test",
  });

  assert.deepEqual(result, { limited: false, retryAfter: 0, unavailable: false });
  assert.deepEqual(state.calls.map(({ operation, prefix }) => ({ operation, prefix })).sort((a, b) => a.prefix.localeCompare(b.prefix)), [
    { operation: "limit", prefix: "auth:login:account" },
    { operation: "limit", prefix: "auth:login:ip" },
  ]);
  assert.equal(state.calls.some((call) => call.identifier.includes("Admin@Example.test")), false);
});

test("account and IP windows return a cooldown after their configured attempt limits", async () => {
  reset();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await checkAuthRateLimit({
      request: loginRequest(),
      action: "login",
      email: "Admin@Example.test",
    });
    assert.equal(result.limited, false);
  }

  const blocked = await checkAuthRateLimit({
    request: loginRequest(),
    action: "login",
    email: "admin@example.test",
  });
  assert.equal(blocked.limited, true);
  assert.ok(blocked.retryAfter > 0);
  assert.equal(state.calls.filter((call) => call.prefix === "auth:login:account" && call.operation === "limit").length, 6);
});

test("rate-limit storage failures fail closed", async () => {
  reset();
  state.failWrites = true;
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(
      await checkAuthRateLimit({ request: loginRequest(), action: "login", email: "person@example.test" }),
      { limited: false, retryAfter: 0, unavailable: true },
    );
  } finally {
    console.error = originalError;
  }
});
