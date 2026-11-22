import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

globalThis.__portfolioApi = {
  user: { id: "owner-id", role: "USER" },
  updateCalls: [],
  lookupCalls: [],
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") {
      return {
        url: dataModule(`export const NextResponse = { json(body, init = {}) { return { body, status: init.status ?? 200, headers: new Headers(init.headers) }; } };`),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/auth") {
      return { url: dataModule("export async function getCurrentUser() { return globalThis.__portfolioApi.user; }"), shortCircuit: true };
    }
    if (specifier === "@/lib/authorization") {
      return {
        url: dataModule(`export function requireSameOriginApiRequest(request) {
          const origin = request.headers.get("origin");
          if (origin && origin === new URL(request.url).origin) return null;
          return Response.json({ success: false }, { status: 403 });
        }`),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/prisma") {
      return {
        url: dataModule(`export const prisma = {
          portfolioSite: {
            async findUnique(args) {
              globalThis.__portfolioApi.lookupCalls.push(args);
              return { id: "portfolio-id", userId: args.where.userId, slug: "owner-profile", published: false, visibility: "PUBLIC" };
            },
            async update(args) {
              globalThis.__portfolioApi.updateCalls.push(args);
              return { id: "portfolio-id", slug: "owner-profile", published: false, visibility: "PUBLIC", ...args.data };
            },
          },
        };`),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/portfolio-public") {
      return { url: new URL("../src/lib/portfolio-public.ts", import.meta.url).href, shortCircuit: true };
    }
    if (specifier === "@/lib/consultations/availability") {
      return { url: new URL("../src/lib/consultations/availability.ts", import.meta.url).href, shortCircuit: true };
    }
    if (specifier === "./timezone-core") {
      return { url: new URL("../src/lib/consultations/timezone-core.ts", import.meta.url).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { GET, PUT } = await import("../src/app/api/portfolio/route.ts");

function request(method, body, options = {}) {
  const hasBody = body !== undefined;
  return new Request("https://crispus.example/api/portfolio", {
    method,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(options.origin !== undefined ? { Origin: options.origin } : {}),
    },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  });
}

test("portfolio GET uses server identity and denies ordinary users selecting another account", async () => {
  globalThis.__portfolioApi = { user: { id: "owner-id", role: "USER" }, updateCalls: [], lookupCalls: [] };
  const own = await GET(request("GET", undefined));
  assert.equal(own.status, 200);
  assert.deepEqual(globalThis.__portfolioApi.lookupCalls[0].where, { userId: "owner-id" });

  globalThis.__portfolioApi.lookupCalls = [];
  const forged = await GET(new Request("https://crispus.example/api/portfolio?adminUserId=victim-id"));
  assert.equal(forged.status, 403);
  assert.equal(globalThis.__portfolioApi.lookupCalls.length, 0);
});

test("portfolio mutations reject cross-origin requests before mutation", async () => {
  globalThis.__portfolioApi = { user: { id: "owner-id", role: "USER" }, updateCalls: [], lookupCalls: [] };
  const response = await PUT(request("PUT", { name: "Owner", title: "Designer" }, { origin: "https://attacker.example" }));
  assert.equal(response.status, 403);
  assert.equal(globalThis.__portfolioApi.updateCalls.length, 0);
});

test("unsafe links, background values and malformed bodies are rejected", async () => {
  globalThis.__portfolioApi = { user: { id: "owner-id", role: "USER" }, updateCalls: [], lookupCalls: [] };
  const origin = "https://crispus.example";
  const base = { name: "Owner", title: "Designer" };

  for (const body of [
    null,
    { ...base, website: "javascript:alert(1)" },
    { ...base, profileImage: "data:image/svg+xml,<svg/>" },
    { ...base, websiteBackground: "url(javascript:alert(1))" },
  ]) {
    const response = await PUT(request("PUT", body, { origin }));
    assert.equal(response.status, 400);
  }

  assert.equal(globalThis.__portfolioApi.updateCalls.length, 0);
});

test("valid owner update saves public state without trusting forged identity or role fields", async () => {
  globalThis.__portfolioApi = { user: { id: "owner-id", role: "USER" }, updateCalls: [], lookupCalls: [] };
  const response = await PUT(request("PUT", {
    name: "Owner",
    title: "Designer",
    visibility: "UNLISTED",
    published: true,
    website: "https://owner.example",
    websiteBackground: "#112233",
    userId: "victim-id",
    role: "SUPER_ADMIN",
  }, { origin: "https://crispus.example" }));

  assert.equal(response.status, 200);
  assert.deepEqual(globalThis.__portfolioApi.updateCalls[0].where, { userId: "owner-id" });
  assert.equal(globalThis.__portfolioApi.updateCalls[0].data.visibility, "UNLISTED");
  assert.equal("userId" in globalThis.__portfolioApi.updateCalls[0].data, false);
  assert.equal("role" in globalThis.__portfolioApi.updateCalls[0].data, false);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
