import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

globalThis.__authorizationCurrentUser = null;
globalThis.__authorizationRedirects = [];

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: dataModule(""), shortCircuit: true };
    }
    if (specifier === "next/navigation") {
      return {
        url: dataModule(`
          export function redirect(destination) {
            globalThis.__authorizationRedirects.push(destination);
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
              return {
                body,
                status: init.status ?? 200,
                headers: new Headers(init.headers),
              };
            }
          }
        `),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/auth") {
      return {
        url: dataModule(`
          export async function getCurrentUser() {
            return globalThis.__authorizationCurrentUser;
          }
        `),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/admin-permissions") {
      return {
        url: new URL("../src/lib/admin-permissions.ts", import.meta.url).href,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const { ADMIN_PERMISSIONS, hasPermission } = await import(
  "../src/lib/admin-permissions.ts"
);
const {
  requireApiPermission,
  requireApiSuperAdmin,
  requirePermission,
  requirePortfolioOwner,
  requireSameOriginApiRequest,
  requireSuperAdmin,
} = await import("../src/lib/authorization.ts");

function resetMocks(user = null) {
  globalThis.__authorizationCurrentUser = user;
  globalThis.__authorizationRedirects.length = 0;
}

test("SUPER_ADMIN receives every explicitly defined administrative permission", () => {
  const user = { id: "admin-1", role: "SUPER_ADMIN" };

  for (const permission of ADMIN_PERMISSIONS) {
    assert.equal(hasPermission(user, permission), true, permission);
  }
});

test("USER receives no administrative permissions", () => {
  const user = { id: "user-1", role: "USER" };

  for (const permission of ADMIN_PERMISSIONS) {
    assert.equal(hasPermission(user, permission), false, permission);
  }
});

test("unknown permissions, missing users, and invalid roles are denied", () => {
  assert.equal(hasPermission({ role: "SUPER_ADMIN" }, "UNKNOWN_PERMISSION"), false);
  assert.equal(hasPermission(null, "ACCOUNT_VIEW"), false);
  assert.equal(hasPermission(undefined, "ACCOUNT_VIEW"), false);
  assert.equal(hasPermission({}, "ACCOUNT_VIEW"), false);
  assert.equal(hasPermission({ role: "OWNER" }, "ACCOUNT_VIEW"), false);
});

test("API permission checks use the server-resolved user, not submitted authority", async () => {
  resetMocks({ id: "user-1", role: "USER" });

  const result = await requireApiPermission("ACCOUNT_VIEW", {
    id: "attacker-controlled",
    role: "SUPER_ADMIN",
    permissions: ADMIN_PERMISSIONS,
  });

  assert.equal(result.user, null);
  assert.equal(result.response.status, 403);
  assert.equal(result.response.body.message, "Permission required.");
  assert.equal(result.response.headers.get("cache-control"), "no-store");
});

test("shared page permission helper authorizes admins and redirects users", async () => {
  const admin = { id: "admin-1", role: "SUPER_ADMIN" };
  resetMocks(admin);
  assert.equal(await requirePermission("AUDIT_VIEW"), admin);

  resetMocks({ id: "user-1", role: "USER" });
  await assert.rejects(requirePermission("AUDIT_VIEW"), /NEXT_REDIRECT/);
  assert.deepEqual(globalThis.__authorizationRedirects, ["/dashboard"]);
});

test("requireSuperAdmin keeps its existing return and redirect behavior", async () => {
  const admin = { id: "admin-1", role: "SUPER_ADMIN" };
  resetMocks(admin);

  assert.equal(await requireSuperAdmin(), admin);

  resetMocks({ id: "user-1", role: "USER" });
  await assert.rejects(requireSuperAdmin(), /NEXT_REDIRECT/);
  assert.deepEqual(globalThis.__authorizationRedirects, ["/dashboard"]);

  resetMocks(null);
  await assert.rejects(requireSuperAdmin(), /NEXT_REDIRECT/);
  assert.deepEqual(globalThis.__authorizationRedirects, ["/login"]);
});

test("API authentication and Super Admin response contracts remain compatible", async () => {
  resetMocks(null);
  const unauthenticated = await requireApiSuperAdmin();
  assert.equal(unauthenticated.user, null);
  assert.equal(unauthenticated.response.status, 401);
  assert.equal(
    unauthenticated.response.body.message,
    "Authentication required.",
  );
  assert.equal(unauthenticated.response.headers.get("cache-control"), "no-store");

  resetMocks({ id: "user-1", role: "USER" });
  const forbidden = await requireApiSuperAdmin();
  assert.equal(forbidden.user, null);
  assert.equal(forbidden.response.status, 403);
  assert.equal(forbidden.response.body.message, "Super Admin access required.");
  assert.equal(forbidden.response.headers.get("cache-control"), "no-store");

  const admin = { id: "admin-1", role: "SUPER_ADMIN" };
  resetMocks(admin);
  const allowed = await requireApiSuperAdmin();
  assert.equal(allowed.user, admin);
  assert.equal(allowed.response, null);
});

test("portfolio ownership checks preserve owner and Super Admin access", async () => {
  const owner = { id: "owner-1", role: "USER" };
  resetMocks(owner);
  assert.equal(await requirePortfolioOwner("owner-1"), owner);

  await assert.rejects(requirePortfolioOwner("other-user"), /NEXT_REDIRECT/);
  assert.deepEqual(globalThis.__authorizationRedirects, ["/dashboard"]);

  const admin = { id: "admin-1", role: "SUPER_ADMIN" };
  resetMocks(admin);
  assert.equal(await requirePortfolioOwner("owner-1"), admin);
});

test("privileged mutation origin guard requires an exact serialized same origin", () => {
  const sameOrigin = new Request("https://example.test/api/admin/write", {
    method: "POST",
    headers: { origin: "https://example.test" },
  });
  assert.equal(requireSameOriginApiRequest(sameOrigin), null);

  for (const headers of [
    {},
    { origin: "https://attacker.test" },
    { origin: "https://example.test/extra-path" },
    { origin: "not a URL" },
  ]) {
    const request = new Request("https://example.test/api/admin/write", {
      method: "POST",
      headers,
    });
    const response = requireSameOriginApiRequest(request);
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});
