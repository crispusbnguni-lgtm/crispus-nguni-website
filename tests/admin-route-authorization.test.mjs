import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

globalThis.__adminRouteState = {
  allowed: false,
  permissions: [],
  reads: 0,
  writes: 0,
  auditRecords: [],
};

const state = () => globalThis.__adminRouteState;
const fakeUser = {
  async count() {
    state().reads += 1;
    return 2;
  },
  async findMany() {
    state().reads += 1;
    return [];
  },
};

const fakeSessions = {
  async count() {
    state().reads += 1;
    return 1;
  },
  async findMany() {
    state().reads += 1;
    return [];
  },
  async findFirst({ where }) {
    state().reads += 1;
    return {
      id: where.id,
      userId: "target-user",
      deviceLabel: "Browser on Linux",
    };
  },
  async updateMany() {
    state().writes += 1;
    return { count: 1 };
  },
};

globalThis.__adminRoutePrisma = {
  user: fakeUser,
  userSession: fakeSessions,
  auditLog: {
    async create({ data }) {
      state().writes += 1;
      state().auditRecords.push(data);
      return data;
    },
  },
  async $transaction(operation) {
    if (Array.isArray(operation)) return Promise.all(operation);
    return operation({ userSession: fakeSessions, auditLog: this.auditLog });
  },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") {
      return {
        url: dataModule(`
          export class NextRequest extends Request {}
          export class NextResponse {
            static json(body, init = {}) {
              return { body, status: init.status ?? 200, headers: new Headers(init.headers) };
            }
          }
        `),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/authorization") {
      return {
        url: dataModule(`
          export async function requireApiPermission(permission) {
            globalThis.__adminRouteState.permissions.push(permission);
            if (!globalThis.__adminRouteState.allowed) {
              return { user: null, response: { status: 403, body: { message: "Permission required." } } };
            }
            return { user: { id: "verified-admin", role: "SUPER_ADMIN" }, response: null };
          }
          export function requireSameOriginApiRequest(request) {
            try {
              const origin = request.headers.get("origin");
              return origin && new URL(origin).origin === origin && origin === new URL(request.url).origin
                ? null
                : { status: 403, body: { message: "Same-origin request required." } };
            } catch {
              return { status: 403, body: { message: "Same-origin request required." } };
            }
          }
        `),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/prisma") {
      return { url: dataModule("export const prisma = globalThis.__adminRoutePrisma;"), shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const [{ GET: getAccounts }, { GET: getSessions, DELETE: revokeSession }] = await Promise.all([
  import("../src/app/api/admin/accounts/route.ts"),
  import("../src/app/api/admin/sessions/route.ts"),
]);

function reset(allowed = false) {
  Object.assign(state(), {
    allowed,
    permissions: [],
    reads: 0,
    writes: 0,
    auditRecords: [],
  });
}

test("account and session APIs reject unauthorized callers before database reads", async () => {
  reset(false);
  const accountResponse = await getAccounts({ nextUrl: new URL("https://example.test/api/admin/accounts") });
  const sessionResponse = await getSessions();

  assert.equal(accountResponse.status, 403);
  assert.equal(sessionResponse.status, 403);
  assert.deepEqual(state().permissions, ["ACCOUNT_VIEW", "SESSION_VIEW"]);
  assert.equal(state().reads, 0);
  assert.equal(state().writes, 0);
});

test("session revocation uses server-authorized permission and server-derived actor", async () => {
  reset(true);
  const request = new Request("https://example.test/api/admin/sessions", {
    method: "DELETE",
    headers: { "content-type": "application/json", origin: "https://example.test" },
    body: JSON.stringify({ sessionId: "session-1", actorId: "forged", role: "USER" }),
  });

  const response = await revokeSession(request);

  assert.equal(response.status, 200);
  assert.deepEqual(state().permissions, ["SESSION_REVOKE"]);
  assert.equal(state().writes, 2);
  assert.equal(state().auditRecords.length, 1);
  assert.equal(state().auditRecords[0].actorUserId, "verified-admin");
  assert.equal(state().auditRecords[0].action, "ADMIN_SESSION_REVOKED");
  assert.equal(state().auditRecords[0].targetId, "session-1");
});

test("cross-origin privileged mutation is rejected before database access", async () => {
  reset(true);
  const request = new Request("https://example.test/api/admin/sessions", {
    method: "DELETE",
    headers: { "content-type": "application/json", origin: "https://attacker.test" },
    body: JSON.stringify({ sessionId: "session-1" }),
  });

  const response = await revokeSession(request);
  assert.equal(response.status, 403);
  assert.equal(state().reads, 0);
  assert.equal(state().writes, 0);
});

test("all Admin APIs use centralized permission checks at the server boundary", async () => {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const routes = [
    ["src/app/api/admin/accounts/route.ts", 'requireApiPermission("ACCOUNT_VIEW")'],
    ["src/app/api/admin/accounts/[id]/governance/route.ts", 'requireApiPermission("ACCOUNT_VIEW")', 'requireApiPermission("AUDIT_VIEW")', 'actionPolicy[action].permission'],
    ["src/app/api/admin/sessions/route.ts", 'requireApiPermission("SESSION_VIEW")', 'requireApiPermission("SESSION_REVOKE")'],
    ["src/app/api/admin/backgrounds/route.ts", 'requireApiPermission("CONTENT_MODERATE")'],
    ["src/app/api/admin/backgrounds/[id]/route.ts", 'requireApiPermission("CONTENT_MODERATE")'],
    ["src/app/api/admin/backgrounds/upload/route.ts", 'requireApiPermission("CONTENT_MODERATE")'],
    ["src/app/api/admin/backgrounds/welcome-page/route.ts", 'requireApiPermission("CMS_MANAGE")'],
    ["src/app/api/admin/backgrounds/welcome-page/media/route.ts", 'requireApiPermission("CMS_MANAGE")'],
    ["src/app/api/admin/backgrounds/welcome-page/preview/route.ts", 'requireApiPermission("CMS_MANAGE")'],
    ["src/app/api/admin/backgrounds/welcome-page/preview-content/route.ts", 'requireApiPermission("CMS_MANAGE")'],
    ["src/app/api/display-studio/route.ts", 'requireApiPermission("SYSTEM_CONFIGURE")'],
  ];

  for (const [relativePath, ...permissions] of routes) {
    const source = await readFile(path.join(projectRoot, relativePath), "utf8");
    for (const permission of permissions) assert.ok(source.includes(permission), `${relativePath} checks ${permission}`);
    assert.doesNotMatch(source, /requireSuperAdmin\(|requireApiSuperAdmin\(|getCurrentUser\(/, relativePath);
  }

  const mutationRoutes = [
    "src/app/api/admin/accounts/[id]/governance/route.ts",
    "src/app/api/admin/sessions/route.ts",
    "src/app/api/admin/backgrounds/route.ts",
    "src/app/api/admin/backgrounds/[id]/route.ts",
    "src/app/api/admin/backgrounds/upload/route.ts",
    "src/app/api/admin/backgrounds/welcome-page/route.ts",
    "src/app/api/admin/backgrounds/welcome-page/media/route.ts",
    "src/app/api/display-studio/route.ts",
  ];
  for (const relativePath of mutationRoutes) {
    const source = await readFile(path.join(projectRoot, relativePath), "utf8");
    assert.match(source, /requireSameOriginApiRequest\(request\)/, `${relativePath} validates request origin`);
  }
});
