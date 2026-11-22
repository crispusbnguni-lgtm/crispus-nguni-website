import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

globalThis.__authSessionWrites = [];
globalThis.__authCookieWrites = [];
globalThis.__authSessionAccount = { accountStatus: "ACTIVE", accountSuspendedUntil: null, verificationStatus: "VERIFIED" };
globalThis.__authSessionRole = "USER";
globalThis.__authSessionMfa = { mfaVerifiedAt: null, secondFactorMethod: null };
globalThis.__authSessionRevoked = false;
globalThis.__authSessionLookupFailure = null;
globalThis.__authSessionCookieValue = null;
globalThis.__authSessionRedirects = [];
globalThis.__authSessionPrisma = {
  user: {
    findUnique: async () => {
      if (globalThis.__authSessionLookupFailure === "user") throw new Error("isolated user lookup failure");
      return { id: "verified-user", role: globalThis.__authSessionRole, email: null, ...globalThis.__authSessionAccount, portfolioSite: null };
    },
  },
  userSession: {
    create: async ({ data }) => {
      globalThis.__authSessionWrites.push(data);
      return { id: `session-${globalThis.__authSessionWrites.length}` };
    },
    update: async () => {},
    findFirst: async () => {
      if (globalThis.__authSessionLookupFailure === "session") throw new Error("isolated session lookup failure");
      if (globalThis.__authSessionRevoked) return null;
      return {
        id: "session-current",
        userId: "verified-user",
        lastActiveAt: new Date(),
        lastReauthenticatedAt: new Date(),
        ...globalThis.__authSessionMfa,
        user: { ...globalThis.__authSessionAccount, role: globalThis.__authSessionRole },
      };
    },
    updateMany: async () => ({ count: 1 }),
  },
  async $transaction(operation) {
    return operation({ user: globalThis.__authSessionPrisma.user, userSession: globalThis.__authSessionPrisma.userSession });
  },
};
globalThis.__authSessionCookieStore = {
  set: (...args) => globalThis.__authCookieWrites.push(args),
  delete: () => {},
  get: (name) => name === "portfolio_session" && globalThis.__authSessionCookieValue ? { value: globalThis.__authSessionCookieValue } : undefined,
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/headers") {
      return {
        url: dataModule(
          "export async function cookies() { return globalThis.__authSessionCookieStore; }",
        ),
        shortCircuit: true,
      };
    }
    if (specifier === "next/navigation") {
      return {
        url: dataModule(`
          export function redirect(destination) {
            globalThis.__authSessionRedirects.push(destination);
            throw new Error("NEXT_REDIRECT");
          }
        `),
        shortCircuit: true,
      };
    }
    if (specifier === "next/server") {
      return {
        url: dataModule(`
          export class NextResponse {
            static json(body, init = {}) {
              return { body, status: init.status ?? 200, headers: new Headers(init.headers) };
            }
          }
        `),
        shortCircuit: true,
      };
    }
    if (specifier === "server-only") {
      return { url: dataModule(""), shortCircuit: true };
    }
    if (specifier === "./prisma" && context.parentURL?.endsWith("/src/lib/auth.ts")) {
      return {
        url: dataModule("export const prisma = globalThis.__authSessionPrisma;"),
        shortCircuit: true,
      };
    }
    if (specifier === "./admin-audit-fallback" && context.parentURL?.endsWith("/src/lib/auth.ts")) {
      return {
        url: dataModule("export async function recordAdminAuditWriteFailure() { return { status: 'unconfirmed' }; }"),
        shortCircuit: true,
      };
    }
    if (specifier === "./account-access" && context.parentURL?.endsWith("/src/lib/auth.ts")) {
      return { url: dataModule("export function isAccountAccessAllowed(account) { return account?.accountStatus === 'ACTIVE' && account?.verificationStatus !== 'REJECTED'; }"), shortCircuit: true };
    }
    if (specifier === "@/lib/auth" && context.parentURL?.endsWith("/src/lib/authorization.ts")) {
      return { url: new URL("../src/lib/auth.ts", import.meta.url).href, shortCircuit: true };
    }
    if (specifier === "@/lib/admin-permissions" && context.parentURL?.endsWith("/src/lib/authorization.ts")) {
      return { url: new URL("../src/lib/admin-permissions.ts", import.meta.url).href, shortCircuit: true };
    }
    if (specifier === "jose") {
      return {
        url: dataModule(`
          export class SignJWT {
            setProtectedHeader() { return this; }
            setIssuedAt() { return this; }
            setExpirationTime() { return this; }
            async sign() { return "isolated-test-session-token"; }
          }
          export async function jwtVerify() { return { payload: { userId: "verified-user", sid: "session-current" } }; }
        `),
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const previousAuthSecret = process.env.AUTH_SECRET;
process.env.AUTH_SECRET = "isolated-auth-session-test-secret";
const { createSession, getCurrentUser, getCurrentSessionDetails } = await import("../src/lib/auth.ts");
const { requireApiSuperAdmin, requireSuperAdmin } = await import("../src/lib/authorization.ts");
if (previousAuthSecret === undefined) delete process.env.AUTH_SECRET;
else process.env.AUTH_SECRET = previousAuthSecret;

function resetMocks() {
  globalThis.__authSessionWrites.length = 0;
  globalThis.__authCookieWrites.length = 0;
  globalThis.__authSessionAccount = { accountStatus: "ACTIVE", accountSuspendedUntil: null, verificationStatus: "VERIFIED" };
  globalThis.__authSessionRole = "USER";
  globalThis.__authSessionMfa = { mfaVerifiedAt: null, secondFactorMethod: null };
  globalThis.__authSessionRevoked = false;
  globalThis.__authSessionLookupFailure = null;
  globalThis.__authSessionCookieValue = null;
  globalThis.__authSessionRedirects.length = 0;
}

test("ordinary session creation preserves the existing non-MFA write", async () => {
  resetMocks();

  await createSession("verified-user", new Request("https://localhost/login"), {
    primaryAuthMethod: "EMAIL",
  });

  assert.equal(globalThis.__authSessionWrites.length, 1);
  const [data] = globalThis.__authSessionWrites;
  assert.equal(data.userId, "verified-user");
  assert.equal(data.primaryAuthMethod, "EMAIL");
  assert.equal(Object.hasOwn(data, "mfaVerifiedAt"), false);
  assert.equal(Object.hasOwn(data, "secondFactorMethod"), false);
  assert.equal(globalThis.__authCookieWrites.length, 1);
});

test("verified MFA metadata persists the method and server timestamp", async () => {
  resetMocks();
  const verifiedAt = new Date("2026-11-11T06:00:00.000Z");

  await createSession("verified-user", undefined, {
    primaryAuthMethod: "PASSKEY",
    verifiedMfa: { secondFactorMethod: "TOTP", verifiedAt },
  });

  const [data] = globalThis.__authSessionWrites;
  assert.equal(data.secondFactorMethod, "TOTP");
  assert.equal(data.mfaVerifiedAt, verifiedAt);
  assert.equal(globalThis.__authCookieWrites.length, 1);
});

test("recovery code is accepted as an explicitly verified method", async () => {
  resetMocks();
  const verifiedAt = new Date("2026-11-11T06:00:00.000Z");

  await createSession("verified-user", undefined, {
    verifiedMfa: { secondFactorMethod: "RECOVERY_CODE", verifiedAt },
  });

  assert.equal(globalThis.__authSessionWrites[0].secondFactorMethod, "RECOVERY_CODE");
  assert.equal(globalThis.__authSessionWrites[0].mfaVerifiedAt, verifiedAt);
});

test("unsupported MFA methods are rejected before session creation", async () => {
  resetMocks();

  await assert.rejects(
    createSession("verified-user", undefined, {
      verifiedMfa: {
        secondFactorMethod: "EMAIL",
        verifiedAt: new Date("2026-11-11T06:00:00.000Z"),
      },
    }),
    /Unsupported verified MFA method/,
  );

  assert.equal(globalThis.__authSessionWrites.length, 0);
  assert.equal(globalThis.__authCookieWrites.length, 0);
});

test("missing or malformed MFA metadata never marks a session as verified", async () => {
  resetMocks();

  await createSession("verified-user");
  const [ordinaryData] = globalThis.__authSessionWrites;
  assert.equal(Object.hasOwn(ordinaryData, "mfaVerifiedAt"), false);
  assert.equal(Object.hasOwn(ordinaryData, "secondFactorMethod"), false);

  await assert.rejects(
    createSession("verified-user", undefined, { verifiedMfa: {} }),
    /Invalid verified MFA session metadata/,
  );
  await assert.rejects(
    createSession("verified-user", undefined, {
      verifiedMfa: {
        secondFactorMethod: "TOTP",
        verifiedAt: new Date(Number.NaN),
      },
    }),
    /Invalid verified MFA timestamp/,
  );
  await assert.rejects(
    createSession("verified-user", undefined, { verifiedMfa: null }),
    /Invalid verified MFA session metadata/,
  );

  assert.equal(globalThis.__authSessionWrites.length, 1);
  assert.equal(globalThis.__authCookieWrites.length, 1);
});

test("existing primary-auth method caller options remain compatible", async () => {
  resetMocks();

  for (const primaryAuthMethod of ["PHONE", "GOOGLE", "APPLE", "PASSKEY"]) {
    await createSession("verified-user", undefined, { primaryAuthMethod });
  }

  assert.deepEqual(
    globalThis.__authSessionWrites.map((data) => data.primaryAuthMethod),
    ["PHONE", "GOOGLE", "APPLE", "PASSKEY"],
  );
  assert.ok(
    globalThis.__authSessionWrites.every(
      (data) => !Object.hasOwn(data, "mfaVerifiedAt") && !Object.hasOwn(data, "secondFactorMethod"),
    ),
  );
});

test("blocked accounts cannot create a session or authentication cookie", async () => {
  resetMocks();
  globalThis.__authSessionAccount = { accountStatus: "BANNED", accountSuspendedUntil: null, verificationStatus: "VERIFIED" };
  await assert.rejects(createSession("verified-user"), /Account access is unavailable/);
  assert.equal(globalThis.__authSessionWrites.length, 0);
  assert.equal(globalThis.__authCookieWrites.length, 0);
});

test("Super Admin cannot create a session from primary authentication without verified MFA metadata", async () => {
  resetMocks();
  globalThis.__authSessionRole = "SUPER_ADMIN";

  await assert.rejects(
    createSession("verified-user", new Request("https://localhost/login"), {
      primaryAuthMethod: "EMAIL",
    }),
    /Verified MFA is required/,
  );

  assert.equal(globalThis.__authSessionWrites.length, 0);
  assert.equal(globalThis.__authCookieWrites.length, 0);
});

test("Super Admin session creation rejects malformed or unsupported MFA evidence before persistence", async () => {
  resetMocks();
  globalThis.__authSessionRole = "SUPER_ADMIN";
  const primary = { primaryAuthMethod: "EMAIL" };

  for (const verifiedMfa of [
    {},
    { secondFactorMethod: "EMAIL", verifiedAt: new Date() },
    { secondFactorMethod: "TOTP", verifiedAt: new Date(Date.now() + 60_000) },
  ]) {
    await assert.rejects(
      createSession("verified-user", undefined, { ...primary, verifiedMfa }),
      /Invalid verified MFA|Unsupported verified MFA/,
    );
  }

  assert.equal(globalThis.__authSessionWrites.length, 0);
  assert.equal(globalThis.__authCookieWrites.length, 0);
});

test("Super Admin creation accepts only complete non-future verified factor metadata", async () => {
  resetMocks();
  globalThis.__authSessionRole = "SUPER_ADMIN";

  for (const secondFactorMethod of ["TOTP", "RECOVERY_CODE"]) {
    await createSession("verified-user", undefined, {
      primaryAuthMethod: "PASSKEY",
      verifiedMfa: {
        secondFactorMethod,
        verifiedAt: new Date("2024-01-01T00:00:00.000Z"),
      },
    });
  }
  assert.equal(globalThis.__authSessionWrites.length, 2);

  await assert.rejects(
    createSession("verified-user", undefined, {
      verifiedMfa: {
        secondFactorMethod: "TOTP",
        verifiedAt: new Date(Date.now() + 60_000),
      },
    }),
    /Invalid verified MFA timestamp/,
  );
  assert.equal(globalThis.__authSessionWrites.length, 2);
});

test("existing Super Admin sessions without valid MFA evidence are rejected", async () => {
  resetMocks();
  globalThis.__authSessionCookieValue = "valid-signed-session";
  globalThis.__authSessionRole = "SUPER_ADMIN";

  assert.equal(await getCurrentUser(), null);
  assert.equal(await getCurrentSessionDetails(), null);

  globalThis.__authSessionMfa = {
    mfaVerifiedAt: new Date("2026-11-12T10:00:00.000Z"),
    secondFactorMethod: "EMAIL",
  };
  assert.equal(await getCurrentUser(), null);
  assert.equal(await getCurrentSessionDetails(), null);

  globalThis.__authSessionMfa = {
    mfaVerifiedAt: new Date(Date.now() + 60_000),
    secondFactorMethod: "TOTP",
  };
  assert.equal(await getCurrentUser(), null);
  assert.equal(await getCurrentSessionDetails(), null);
});

test("MFA-verified Super Admin sessions remain authorized without an invented age limit", async () => {
  resetMocks();
  globalThis.__authSessionCookieValue = "valid-signed-session";
  globalThis.__authSessionRole = "SUPER_ADMIN";

  for (const secondFactorMethod of ["TOTP", "RECOVERY_CODE"]) {
    globalThis.__authSessionMfa = {
      mfaVerifiedAt: new Date("2024-01-01T00:00:00.000Z"),
      secondFactorMethod,
    };
    assert.equal((await getCurrentUser())?.role, "SUPER_ADMIN");
    assert.equal((await getCurrentSessionDetails())?.userId, "verified-user");
  }
});

test("page and API Super Admin authorization reject an old unverified session", async () => {
  resetMocks();
  globalThis.__authSessionCookieValue = "valid-signed-session";
  globalThis.__authSessionRole = "SUPER_ADMIN";

  await assert.rejects(requireSuperAdmin(), /NEXT_REDIRECT/);
  assert.deepEqual(globalThis.__authSessionRedirects, ["/login"]);
  const denied = await requireApiSuperAdmin();
  assert.equal(denied.user, null);
  assert.equal(denied.response.status, 401);

  globalThis.__authSessionMfa = {
    mfaVerifiedAt: new Date("2026-11-12T10:00:00.000Z"),
    secondFactorMethod: "TOTP",
  };
  const pageUser = await requireSuperAdmin();
  assert.equal(pageUser.role, "SUPER_ADMIN");
  const apiResult = await requireApiSuperAdmin();
  assert.equal(apiResult.user?.role, "SUPER_ADMIN");
  assert.equal(apiResult.response, null);
});

test("ordinary USER sessions keep their existing non-MFA access behavior", async () => {
  resetMocks();
  globalThis.__authSessionCookieValue = "valid-signed-session";

  assert.equal((await getCurrentUser())?.role, "USER");
  assert.equal((await getCurrentSessionDetails())?.userId, "verified-user");
});

test("revoked Super Admin sessions are rejected even when their MFA evidence is valid", async () => {
  resetMocks();
  globalThis.__authSessionCookieValue = "valid-signed-session";
  globalThis.__authSessionRole = "SUPER_ADMIN";
  globalThis.__authSessionMfa = {
    mfaVerifiedAt: new Date("2026-11-12T10:00:00.000Z"),
    secondFactorMethod: "TOTP",
  };
  globalThis.__authSessionRevoked = true;

  assert.equal(await getCurrentUser(), null);
  assert.equal(await getCurrentSessionDetails(), null);
});

test("database lookup failures fail closed for session and user authorization", async () => {
  resetMocks();
  globalThis.__authSessionCookieValue = "valid-signed-session";
  globalThis.__authSessionRole = "SUPER_ADMIN";
  globalThis.__authSessionMfa = {
    mfaVerifiedAt: new Date("2026-11-12T10:00:00.000Z"),
    secondFactorMethod: "TOTP",
  };

  globalThis.__authSessionLookupFailure = "session";
  assert.equal(await getCurrentUser(), null);
  assert.equal(await getCurrentSessionDetails(), null);

  globalThis.__authSessionLookupFailure = "user";
  assert.equal(await getCurrentUser(), null);
});

test("existing sessions are rejected when account status becomes restricted", async () => {
  resetMocks();
  globalThis.__authSessionCookieValue = "valid-signed-session";
  globalThis.__authSessionAccount = { accountStatus: "SUSPENDED", accountSuspendedUntil: null, verificationStatus: "VERIFIED" };
  assert.equal(await getCurrentUser(), null);
  assert.equal(await getCurrentSessionDetails(), null);

  globalThis.__authSessionAccount = { accountStatus: "BANNED", accountSuspendedUntil: null, verificationStatus: "VERIFIED" };
  assert.equal(await getCurrentUser(), null);
  assert.equal(await getCurrentSessionDetails(), null);
});
