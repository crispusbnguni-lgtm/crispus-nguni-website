import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

globalThis.__adminAuditPrisma = {
  auditLog: {
    create: async () => { throw new Error("Unconfigured audit mock."); },
    findUnique: async () => null,
  },
  userSession: { create: async () => ({ id: "session-test" }), update: async () => {} },
};
globalThis.__adminAuditFallback = async () => ({ status: "unconfirmed" });
globalThis.__adminAuditUuid = () => "1be2b48b-c431-47d2-9637-43fc2ce5d3dd";
globalThis.__adminAuditCrypto = { randomUUID: () => globalThis.__adminAuditUuid() };
globalThis.__adminAuditCookies = { set() {}, delete() {} };

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/headers" && context.parentURL?.endsWith("/src/lib/auth.ts")) {
      return {
        url: dataModule("export async function cookies() { return globalThis.__adminAuditCookies; }"),
        shortCircuit: true,
      };
    }
    if (specifier === "./prisma" && context.parentURL?.endsWith("/src/lib/auth.ts")) {
      return {
        url: dataModule("export const prisma = globalThis.__adminAuditPrisma;"),
        shortCircuit: true,
      };
    }
    if (specifier === "./account-access" && context.parentURL?.endsWith("/src/lib/auth.ts")) {
      return {
        url: dataModule("export function isAccountAccessAllowed() { return true; }"),
        shortCircuit: true,
      };
    }
    if (specifier === "./admin-audit-fallback" && context.parentURL?.endsWith("/src/lib/auth.ts")) {
      return {
        url: dataModule(`export async function recordAdminAuditWriteFailure(input) {
          return globalThis.__adminAuditFallback(input);
        }`),
        shortCircuit: true,
      };
    }
    if (specifier === "node:crypto" && context.parentURL?.endsWith("/src/lib/auth.ts")) {
      return {
        url: dataModule("export const randomUUID = () => globalThis.__adminAuditCrypto.randomUUID();"),
        shortCircuit: true,
      };
    }
    if (specifier === "jose" && context.parentURL?.endsWith("/src/lib/auth.ts")) {
      return {
        url: dataModule(`
          export class SignJWT {
            setProtectedHeader() { return this; }
            setIssuedAt() { return this; }
            setExpirationTime() { return this; }
            async sign() { return "test-token"; }
          }
          export async function jwtVerify() { throw new Error("Not used in audit tests."); }
        `),
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const previousAuthSecret = process.env.AUTH_SECRET;
process.env.AUTH_SECRET = "isolated-admin-audit-test-secret";
const { logSuperAdminVerificationExemption } = await import("../src/lib/auth.ts");
if (previousAuthSecret === undefined) delete process.env.AUTH_SECRET;
else process.env.AUTH_SECRET = previousAuthSecret;

const eventId = "1be2b48b-c431-47d2-9637-43fc2ce5d3dd";

function resetMocks() {
  globalThis.__adminAuditUuid = () => eventId;
  globalThis.__adminAuditFallback = async () => ({ status: "unconfirmed" });
  globalThis.__adminAuditPrisma.auditLog.create = async () => {};
  globalThis.__adminAuditPrisma.auditLog.findUnique = async () => null;
}

test("primary audit success records a UUID and skips fallback", async () => {
  resetMocks();
  let created;
  let fallbackCalls = 0;
  globalThis.__adminAuditPrisma.auditLog.create = async ({ data }) => { created = data; };
  globalThis.__adminAuditFallback = async () => { fallbackCalls += 1; };

  const result = await logSuperAdminVerificationExemption("server-user", "EMAIL", {
    emailVerified: false,
  });

  assert.equal(result.status, "primary_recorded");
  assert.equal(result.eventId, eventId);
  assert.equal(created.eventId, eventId);
  assert.equal(created.actorUserId, "server-user");
  assert.equal(created.action, "SUPER_ADMIN_UNVERIFIED_AUTHENTICATION");
  assert.equal(fallbackCalls, 0);
});

test("primary failure invokes fallback with the identical event ID and trusted actor", async () => {
  resetMocks();
  let fallbackInput;
  globalThis.__adminAuditPrisma.auditLog.create = async () => { throw new Error("P1001 safe classification test"); };
  globalThis.__adminAuditPrisma.auditLog.findUnique = async () => null;
  globalThis.__adminAuditFallback = async (input) => {
    fallbackInput = input;
    return { status: "fallback_accepted" };
  };

  const result = await logSuperAdminVerificationExemption("server-user", "GOOGLE", {
    emailVerified: false,
  });

  assert.equal(result.status, "fallback_attempted");
  assert.equal(result.eventId, eventId);
  assert.equal(fallbackInput.eventId, eventId);
  assert.deepEqual(fallbackInput.actor, {
    userId: "server-user",
    role: "SUPER_ADMIN",
    authenticationMethod: "GOOGLE",
  });
  assert.equal(fallbackInput.primaryError.message, "P1001 safe classification test");
});

test("both sinks failing does not throw or prevent the helper from returning", async () => {
  resetMocks();
  globalThis.__adminAuditPrisma.auditLog.create = async () => { throw new Error("database unavailable"); };
  globalThis.__adminAuditPrisma.auditLog.findUnique = async () => { throw new Error("lookup unavailable"); };
  globalThis.__adminAuditFallback = async () => { throw new Error("fallback unavailable"); };

  await assert.doesNotReject(async () => {
    const result = await logSuperAdminVerificationExemption("server-user", "PHONE", {
      emailVerified: false,
      phoneVerified: false,
    });
    assert.equal(result.status, "unconfirmed");
  });
});

test("duplicate event IDs cannot create duplicate primary rows", async () => {
  resetMocks();
  const rows = new Map();
  let createCalls = 0;
  let fallbackCalls = 0;
  globalThis.__adminAuditPrisma.auditLog.create = async ({ data }) => {
    createCalls += 1;
    if (rows.has(data.eventId)) {
      const error = new Error("unique constraint");
      error.code = "P2002";
      throw error;
    }
    rows.set(data.eventId, data);
  };
  globalThis.__adminAuditPrisma.auditLog.findUnique = async ({ where }) => {
    const row = rows.get(where.eventId);
    return row ? { eventId: row.eventId } : null;
  };
  globalThis.__adminAuditFallback = async () => { fallbackCalls += 1; };

  const first = await logSuperAdminVerificationExemption("server-user", "EMAIL", { emailVerified: false });
  const second = await logSuperAdminVerificationExemption("server-user", "EMAIL", { emailVerified: false });

  assert.equal(first.status, "primary_recorded");
  assert.equal(second.status, "primary_recorded");
  assert.equal(createCalls, 2);
  assert.equal(rows.size, 1);
  assert.equal(fallbackCalls, 0);
});

test("ambiguous primary outcome is confirmed by event ID before fallback", async () => {
  resetMocks();
  let fallbackCalls = 0;
  globalThis.__adminAuditPrisma.auditLog.create = async () => {
    throw new Error("connection dropped after commit");
  };
  globalThis.__adminAuditPrisma.auditLog.findUnique = async ({ where }) => ({ eventId: where.eventId });
  globalThis.__adminAuditFallback = async () => { fallbackCalls += 1; };

  const result = await logSuperAdminVerificationExemption("server-user", "EMAIL", { emailVerified: false });

  assert.equal(result.status, "primary_recorded");
  assert.equal(result.eventId, eventId);
  assert.equal(fallbackCalls, 0);
});

test("fallback receives the same ID when primary write and confirmation both fail", async () => {
  resetMocks();
  let fallbackInput;
  globalThis.__adminAuditPrisma.auditLog.create = async () => { throw new Error("write failed"); };
  globalThis.__adminAuditPrisma.auditLog.findUnique = async () => null;
  globalThis.__adminAuditFallback = async (input) => { fallbackInput = input; return { status: "unconfirmed" }; };

  const result = await logSuperAdminVerificationExemption("server-user", "PHONE", { emailVerified: false });

  assert.equal(result.status, "fallback_attempted");
  assert.equal(fallbackInput.eventId, eventId);
  assert.equal(result.eventId, fallbackInput.eventId);
});

test("all four auth paths pass primary authentication and exemption audit before shared completion", async () => {
  const cases = [
    ["src/app/api/auth/login/route.ts", "await argon2.verify(", "logSuperAdminVerificationExemption", "completePrimaryAuthentication"],
    ["src/lib/phone-auth-routes.ts", "await verifyPhoneOtpChallenge(", "logSuperAdminVerificationExemption", "completePrimaryAuthentication"],
    ["src/app/api/auth/magic-link/verify/route.ts", "await consumeVerifiedMagicLink(", "logSuperAdminVerificationExemption", "completePrimaryAuthentication"],
    ["src/app/api/auth/google/callback/route.ts", "await verifyGoogleIdToken(", "logSuperAdminVerificationExemption", "completePrimaryAuthentication"],
  ];

  for (const [path, primaryMarker, auditMarker, completionMarker] of cases) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    const primaryIndex = source.indexOf(primaryMarker);
    const auditIndex = source.indexOf(auditMarker, primaryIndex + primaryMarker.length);
    const completionIndex = source.indexOf(completionMarker, auditIndex + auditMarker.length);
    assert.notEqual(primaryIndex, -1, `${path}: primary authentication marker`);
    assert.ok(auditIndex > primaryIndex, `${path}: audit follows primary authentication`);
    assert.ok(completionIndex > auditIndex, `${path}: shared completion follows audit helper`);
  }
});
