import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

globalThis.__governanceState = {
  allowed: true,
  actorId: "admin-one",
  auditFailure: false,
  reads: 0,
  audits: [],
  users: [],
  sessions: [],
};
const state = () => globalThis.__governanceState;

const clone = (value) => structuredClone(value);
function txFor(db) {
  return {
    user: {
      async findUnique({ where }) { state().reads += 1; return clone(db.users.find((user) => user.id === where.id) ?? null); },
      async count({ where }) {
        if (state().activeAdminCountOverride !== undefined) return state().activeAdminCountOverride;
        return db.users.filter((user) => user.role === where.role && user.verificationStatus !== "REJECTED" && (
          user.accountStatus === "ACTIVE" || (user.accountStatus === "SUSPENDED" && user.accountSuspendedUntil && new Date(user.accountSuspendedUntil) <= new Date())
        )).length;
      },
      async updateMany({ where, data }) {
        const user = db.users.find((candidate) => candidate.id === where.id && candidate.accountStatus === where.accountStatus && candidate.verificationStatus === where.verificationStatus);
        if (!user) return { count: 0 };
        Object.assign(user, data);
        return { count: 1 };
      },
    },
    userSession: {
      async updateMany({ where, data }) {
        const now = new Date();
        const matched = db.sessions.filter((session) => session.userId === where.userId && session.revokedAt === null && new Date(session.expiresAt) > now);
        matched.forEach((session) => Object.assign(session, data));
        return { count: matched.length };
      },
    },
    auditLog: {
      async findMany() { return clone(db.audits); },
      async create({ data }) {
        if (state().auditFailure) throw new Error("synthetic audit failure");
        db.audits.push(clone(data));
        return data;
      },
    },
  };
}

globalThis.__governanceDb = {
  users: [], sessions: [], audits: [],
};
globalThis.__governancePrisma = {
  get user() { return txFor(globalThis.__governanceDb).user; },
  get userSession() { return txFor(globalThis.__governanceDb).userSession; },
  get auditLog() { return txFor(globalThis.__governanceDb).auditLog; },
  async $transaction(operation) {
    const working = clone(globalThis.__governanceDb);
    const result = await operation(txFor(working));
    globalThis.__governanceDb = working;
    return result;
  },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") return { url: dataModule(`
      export class NextRequest extends Request {}
      export class NextResponse { static json(body, init = {}) { return Response.json(body, init); } }
    `), shortCircuit: true };
    if (specifier === "@/lib/authorization") return { url: dataModule(`
      export async function requireApiPermission(permission) {
        globalThis.__governanceState.reads += 1;
        if (!globalThis.__governanceState.allowed) return { user: null, response: Response.json({ success:false, message:"Permission required." }, { status:403 }) };
        return { user: { id: globalThis.__governanceState.actorId, role:"SUPER_ADMIN" }, response:null };
      }
      export function requireSameOriginApiRequest(request) {
        try {
          const origin = request.headers.get("origin");
          return origin && new URL(origin).origin === origin && origin === new URL(request.url).origin
            ? null
            : Response.json({ success:false, message:"Same-origin request required." }, { status:403 });
        } catch {
          return Response.json({ success:false, message:"Same-origin request required." }, { status:403 });
        }
      }
    `), shortCircuit: true };
    if (specifier === "@/lib/admin-audit") return { url: dataModule(`
      export async function resolveAdminAuditActor() { return Object.freeze({ userId: globalThis.__governanceState.actorId }); }
      export async function writeAdminAudit(actor, input, tx) {
        if (!tx) throw new Error("transaction client required");
        await tx.auditLog.create({ data: { actorUserId:actor.userId, ...input, metadata:input.metadata } });
      }
    `), shortCircuit: true };
    if (specifier === "@/lib/prisma") return { url: dataModule("export const prisma = globalThis.__governancePrisma;"), shortCircuit: true };
    if (specifier === "@/lib/account-access") return { url: dataModule(`
      export function isAccountAccessAllowed(account, now = new Date()) {
        if (!account || !["ACTIVE","SUSPENDED"].includes(account.accountStatus) || !["PENDING","VERIFIED"].includes(account.verificationStatus)) return false;
        return account.accountStatus === "ACTIVE" || (account.accountSuspendedUntil !== null && new Date(account.accountSuspendedUntil) <= now);
      }
    `), shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const { GET, POST } = await import("../src/app/api/admin/accounts/[id]/governance/route.ts");

function reset({ targetRole = "USER", actorId = "admin-one", extraSuperAdmin = false } = {}) {
  const now = Date.now();
  state().allowed = true;
  state().actorId = actorId;
  state().auditFailure = false;
  state().reads = 0;
  state().audits = [];
  state().activeAdminCountOverride = undefined;
  state().users = [];
  state().sessions = [];
  const target = {
    id: "target-user", role: targetRole, accountStatus: "ACTIVE", verificationStatus: "PENDING",
    accountSuspendedUntil: null, accountStatusReason: null, verificationReason: null,
    name: "Test account", email: "test@example.test", createdAt: new Date(), emailVerifiedAt: null,
    identities: [{ verifiedAt: null }], totpCredential: { verifiedAt: new Date() },
    _count: { recoveryCodes: 3 },
  };
  const admin = { id: actorId, role: "SUPER_ADMIN", accountStatus: "ACTIVE", verificationStatus: "VERIFIED", accountSuspendedUntil: null };
  state().users.push(target, admin);
  if (extraSuperAdmin) state().users.push({ id: "admin-two", role: "SUPER_ADMIN", accountStatus: "ACTIVE", verificationStatus: "VERIFIED", accountSuspendedUntil: null });
  state().sessions = [
    { id: "session-a", userId: target.id, expiresAt: new Date(now + 60_000), revokedAt: null },
    { id: "session-b", userId: target.id, expiresAt: new Date(now + 60_000), revokedAt: null },
  ];
  globalThis.__governanceDb = { users: clone(state().users), sessions: clone(state().sessions), audits: [] };
}

function post(action, extra = {}, targetId = "target-user", headers = { origin: "https://app.example.test", "content-type": "application/json" }) {
  return new Request(`https://app.example.test/api/admin/accounts/${targetId}/governance`, {
    method: "POST", headers, body: JSON.stringify({ action, reason: "Reviewed case ref 4821", ...extra }),
  });
}

async function result(response) { return response.json(); }

test("unauthorized account governance is rejected before account data is read", async () => {
  reset();
  state().allowed = false;
  const response = await POST(post("BAN"), { params: Promise.resolve({ id: "target-user" }) });
  assert.equal(response.status, 403);
  assert.equal(globalThis.__governanceDb.audits.length, 0);
});

test("account detail exposes review and security status without credential material", async () => {
  reset();
  const response = await GET(new Request("https://app.example.test/api/admin/accounts/target-user/governance"), { params: Promise.resolve({ id: "target-user" }) });
  assert.equal(response.status, 200);
  const body = await result(response);
  assert.equal(body.account.emailVerified, false);
  assert.equal(body.account.phoneVerified, false);
  assert.equal(body.account.mfaEnrolled, true);
  assert.equal(body.account.activeRecoveryCodeCount, 3);
  assert.equal(JSON.stringify(body).includes("secretCiphertext"), false);
});

test("verification records a server-derived actor and stays separate from contact verification", async () => {
  reset();
  const response = await POST(post("VERIFY", { actorId: "forged", role: "USER" }), { params: Promise.resolve({ id: "target-user" }) });
  assert.equal(response.status, 200);
  const db = globalThis.__governanceDb;
  assert.equal(db.users[0].verificationStatus, "VERIFIED");
  assert.equal(db.audits[0].actorUserId, "admin-one");
  assert.equal(db.audits[0].action, "ADMIN_ACCOUNT_VERIFIED");
  assert.equal(db.audits[0].targetId, "target-user");
  assert.equal(db.audits[0].metadata.actionReason, "Reviewed case ref 4821");
});

test("rejection blocks access and revokes every active session atomically", async () => {
  reset();
  const response = await POST(post("REJECT"), { params: Promise.resolve({ id: "target-user" }) });
  assert.equal(response.status, 200);
  const db = globalThis.__governanceDb;
  assert.equal(db.users[0].verificationStatus, "REJECTED");
  assert.ok(db.sessions.every((session) => session.revokedAt));
  assert.deepEqual(db.audits.map((event) => event.action), ["ADMIN_ACCOUNT_VERIFICATION_REJECTED", "ADMIN_ALL_SESSIONS_REVOKED"]);
});

test("temporary suspension validates expiry and records the expiry while revoking sessions", async () => {
  reset();
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const response = await POST(post("SUSPEND", { expiresAt }), { params: Promise.resolve({ id: "target-user" }) });
  assert.equal(response.status, 200);
  const target = globalThis.__governanceDb.users[0];
  assert.equal(target.accountStatus, "SUSPENDED");
  assert.equal(new Date(target.accountSuspendedUntil).toISOString(), expiresAt);
  assert.ok(globalThis.__governanceDb.sessions.every((session) => session.revokedAt));
});

test("permanent ban blocks access and reinstatement restores access", async () => {
  reset();
  const banned = await POST(post("BAN"), { params: Promise.resolve({ id: "target-user" }) });
  assert.equal(banned.status, 200);
  assert.equal(globalThis.__governanceDb.users[0].accountStatus, "BANNED");
  const restored = await POST(post("REINSTATE"), { params: Promise.resolve({ id: "target-user" }) });
  assert.equal(restored.status, 200);
  assert.equal(globalThis.__governanceDb.users[0].accountStatus, "ACTIVE");
  assert.deepEqual(globalThis.__governanceDb.audits.map((event) => event.action), ["ADMIN_ACCOUNT_BANNED", "ADMIN_ALL_SESSIONS_REVOKED", "ADMIN_ACCOUNT_REINSTATED"]);
});

test("reinstatement moves a rejected account to pending review rather than asserting verification", async () => {
  reset();
  globalThis.__governanceDb.users[0].verificationStatus = "REJECTED";
  state().users[0].verificationStatus = "REJECTED";
  const response = await POST(post("REINSTATE"), { params: Promise.resolve({ id: "target-user" }) });
  assert.equal(response.status, 200);
  assert.equal(globalThis.__governanceDb.users[0].verificationStatus, "PENDING");
});

test("bulk session revocation audits the exact count and a retry does not change sessions", async () => {
  reset();
  const first = await POST(post("REVOKE_SESSIONS"), { params: Promise.resolve({ id: "target-user" }) });
  assert.equal(first.status, 200);
  assert.equal((await result(first)).revokedCount, 2);
  assert.equal(globalThis.__governanceDb.audits[0].action, "ADMIN_ALL_SESSIONS_REVOKED");
  const retry = await POST(post("REVOKE_SESSIONS"), { params: Promise.resolve({ id: "target-user" }) });
  assert.equal(retry.status, 200);
  assert.equal((await result(retry)).revokedCount, 0);
});

test("audit failure rolls back the account change and session revocation", async () => {
  reset();
  state().auditFailure = true;
  const response = await POST(post("BAN"), { params: Promise.resolve({ id: "target-user" }) });
  assert.equal(response.status, 500);
  assert.equal(globalThis.__governanceDb.users[0].accountStatus, "ACTIVE");
  assert.ok(globalThis.__governanceDb.sessions.every((session) => session.revokedAt === null));
  assert.equal(globalThis.__governanceDb.audits.length, 0);
});

test("self-administration and last Super Admin disabling are blocked", async () => {
  reset({ actorId: "target-user" });
  const self = await POST(post("BAN"), { params: Promise.resolve({ id: "target-user" }) });
  assert.equal(self.status, 409);
  reset({ targetRole: "SUPER_ADMIN" });
  state().activeAdminCountOverride = 1;
  const last = await POST(post("SUSPEND"), { params: Promise.resolve({ id: "target-user" }) });
  assert.equal(last.status, 409);
  assert.equal(globalThis.__governanceDb.users[0].accountStatus, "ACTIVE");
});

test("second Super Admin can be restricted without disabling the last active administrator", async () => {
  reset({ targetRole: "SUPER_ADMIN", extraSuperAdmin: true });
  const response = await POST(post("BAN"), { params: Promise.resolve({ id: "target-user" }) });
  assert.equal(response.status, 200);
  assert.equal(globalThis.__governanceDb.users[0].accountStatus, "BANNED");
});

test("cross-origin requests, invalid expiry and duplicate state transitions are rejected", async () => {
  reset();
  const crossOrigin = await POST(post("BAN", {}, "target-user", { origin: "https://attacker.test", "content-type": "application/json" }), { params: Promise.resolve({ id: "target-user" }) });
  assert.equal(crossOrigin.status, 403);
  const invalidExpiry = await POST(post("SUSPEND", { expiresAt: "not-a-date" }), { params: Promise.resolve({ id: "target-user" }) });
  assert.equal(invalidExpiry.status, 400);
  const first = await POST(post("VERIFY"), { params: Promise.resolve({ id: "target-user" }) });
  assert.equal(first.status, 200);
  const duplicate = await POST(post("VERIFY"), { params: Promise.resolve({ id: "target-user" }) });
  assert.equal(duplicate.status, 409);
  assert.equal(globalThis.__governanceDb.audits.length, 1);
});

test("directory and governance APIs use verified status/MFA fields without exposing credential material", async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const accounts = await readFile(path.join(root, "src/app/api/admin/accounts/route.ts"), "utf8");
  const governance = await readFile(path.join(root, "src/app/api/admin/accounts/[id]/governance/route.ts"), "utf8");
  assert.match(accounts, /accountStatus:\s*true/);
  assert.match(accounts, /verificationStatus:\s*true/);
  assert.match(governance, /totpCredential:\s*\{\s*select:\s*\{\s*verifiedAt:\s*true/);
  assert.doesNotMatch(governance, /secretCiphertext|codeHash|passwordHash/);
});

test("all five implemented primary login routes still pass through shared MFA completion", async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const providerFiles = [
    "src/app/api/auth/login/route.ts",
    "src/app/api/auth/google/callback/route.ts",
    "src/lib/phone-auth-routes.ts",
    "src/app/api/auth/magic-link/verify/route.ts",
    "src/app/api/auth/passkey/login/verify/route.ts",
  ];
  for (const file of providerFiles) {
    const source = await readFile(path.join(root, file), "utf8");
    assert.match(source, /completePrimaryAuthentication\(/, file);
  }
});
