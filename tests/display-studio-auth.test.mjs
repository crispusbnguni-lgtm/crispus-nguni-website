import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

globalThis.__displayStudioUser = null;
globalThis.__displayStudioDbState = {
  preferences: null,
  reads: 0,
  writes: 0,
  auditWrites: 0,
  auditRecords: [],
  auditFailure: false,
};
globalThis.__displayStudioPrisma = {
  displayStudioSettings: {
    async findUnique() {
      globalThis.__displayStudioDbState.reads += 1;
      return globalThis.__displayStudioDbState.preferences
        ? { id: "main", preferences: globalThis.__displayStudioDbState.preferences }
        : null;
    },
  },
  async $transaction(callback) {
    const working = structuredClone(globalThis.__displayStudioDbState);
    const tx = {
      displayStudioSettings: {
        async findUnique() {
          globalThis.__displayStudioDbState.reads += 1;
          return working.preferences ? { id: "main", preferences: working.preferences } : null;
        },
        async upsert({ create, update }) {
          globalThis.__displayStudioDbState.writes += 1;
          working.preferences = update.preferences ?? create.preferences;
          return { id: "main", preferences: working.preferences };
        },
      },
      auditLog: {
        async create({ data }) {
          globalThis.__displayStudioDbState.auditWrites += 1;
          if (globalThis.__displayStudioDbState.auditFailure) throw new Error("simulated audit failure");
          working.auditRecords.push(data);
          return data;
        },
      },
    };
    const result = await callback(tx);
    globalThis.__displayStudioDbState.preferences = working.preferences;
    globalThis.__displayStudioDbState.auditRecords = working.auditRecords;
    return result;
  },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: dataModule(""), shortCircuit: true };
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
    if (specifier === "next/navigation") {
      return {
        url: dataModule(`
          export function redirect(destination) {
            throw new Error("NEXT_REDIRECT:" + destination);
          }
        `),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/observability") {
      return { url: dataModule(`export function reportOperationalFailure() {}`), shortCircuit: true };
    }
    if (specifier === "@/lib/auth") {
      return {
        url: dataModule(`
          export async function getCurrentUser() {
            return globalThis.__displayStudioUser;
          }
        `),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/prisma") {
      return {
        url: dataModule(`export const prisma = globalThis.__displayStudioPrisma;`),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/admin-audit") {
      return {
        url: dataModule(`
          export async function resolveAdminAuditActor() {
            const user = globalThis.__displayStudioUser;
            if (!user || user.role !== "SUPER_ADMIN") throw new Error("Audit actor unavailable");
            return Object.freeze({ userId: user.id, role: user.role });
          }
          export async function writeAdminAudit(actor, input, transaction) {
            await transaction.auditLog.create({
              data: {
                actorUserId: actor.userId,
                action: input.action,
                targetType: input.targetType,
                targetId: input.targetId,
                metadata: { ...input.metadata, reason: input.reason, outcome: input.outcome },
              },
            });
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
    if (specifier === "@/lib/authorization") {
      return {
        url: new URL("../src/lib/authorization.ts", import.meta.url).href,
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/display-studio-preferences") {
      return { url: new URL("../src/lib/display-studio-preferences.ts", import.meta.url).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { GET, PUT } = await import("../src/app/api/display-studio/route.ts");

function reset(user = null) {
  globalThis.__displayStudioUser = user;
  globalThis.__displayStudioDbState.preferences = null;
  globalThis.__displayStudioDbState.reads = 0;
  globalThis.__displayStudioDbState.writes = 0;
  globalThis.__displayStudioDbState.auditWrites = 0;
  globalThis.__displayStudioDbState.auditRecords = [];
  globalThis.__displayStudioDbState.auditFailure = false;
}

function validPreferences() {
  return {
    textScale: 1,
    readingWidth: "normal",
    fontFamily: "one-ui",
    glassLevel: 0.72,
    frostLevel: 0,
    transparency: 0.72,
    reflectionLevel: 0.65,
    glassDepth: 0.65,
    appearancePreset: "crispus",
    lineHeight: "normal",
    letterSpacing: "normal",
    colorMode: "dark",
    highContrast: false,
    reduceMotion: false,
    reduceTransparency: false,
    underlineLinks: false,
    focusMode: false,
  };
}

test("Display Studio GET denies unauthenticated and ordinary users before reading settings", async () => {
  reset(null);
  const unauthenticated = await GET();
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticated.headers.get("cache-control"), "no-store");
  assert.equal(globalThis.__displayStudioDbState.reads, 0);

  reset({ id: "user-1", role: "USER" });
  const forbidden = await GET();
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.headers.get("cache-control"), "no-store");
  assert.equal(globalThis.__displayStudioDbState.reads, 0);
});

test("Display Studio GET returns saved settings to a server-authorized Super Admin", async () => {
  reset({ id: "admin-1", role: "SUPER_ADMIN" });
  globalThis.__displayStudioDbState.preferences = validPreferences();

  const response = await GET();
  assert.equal(response.status, 200);
  assert.equal(response.body.preferences, globalThis.__displayStudioDbState.preferences);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(globalThis.__displayStudioDbState.reads, 1);
});

test("Display Studio PUT continues to require Super Admin authorization", async () => {
  reset({ id: "user-1", role: "USER" });
  const request = new Request("http://localhost/api/display-studio", {
    method: "PUT",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({ preferences: validPreferences() }),
  });

  const response = await PUT(request);
  assert.equal(response.status, 403);
  assert.equal(globalThis.__displayStudioDbState.writes, 0);
});

test("Display Studio PUT denies anonymous visitors before reading or writing settings", async () => {
  reset(null);
  const request = new Request("http://localhost/api/display-studio", {
    method: "PUT",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({ preferences: validPreferences() }),
  });

  const response = await PUT(request);
  assert.equal(response.status, 401);
  assert.equal(globalThis.__displayStudioDbState.writes, 0);
  assert.equal(globalThis.__displayStudioDbState.auditWrites, 0);
});

test("Display Studio PUT preserves valid preference updates for Super Admin", async () => {
  reset({ id: "admin-1", role: "SUPER_ADMIN" });
  const preferences = validPreferences();
  const request = new Request("http://localhost/api/display-studio", {
    method: "PUT",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({ preferences, actorId: "forged-user", role: "USER" }),
  });

  const response = await PUT(request);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.preferences, preferences);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(globalThis.__displayStudioDbState.writes, 1);
  assert.equal(globalThis.__displayStudioDbState.auditWrites, 1);
  assert.equal(globalThis.__displayStudioDbState.auditRecords[0].actorUserId, "admin-1");
  assert.equal(globalThis.__displayStudioDbState.auditRecords[0].action, "ADMIN_DISPLAY_STUDIO_UPDATED");
  assert.equal(globalThis.__displayStudioDbState.auditRecords[0].targetType, "DisplayStudioSettings");
  assert.equal(globalThis.__displayStudioDbState.auditRecords[0].targetId, "main");
  assert.deepEqual(globalThis.__displayStudioDbState.auditRecords[0].metadata.changedFields, Object.keys(preferences));
  assert.equal(JSON.stringify(globalThis.__displayStudioDbState.auditRecords).includes(JSON.stringify(preferences)), false);
});

test("Display Studio audit failure rolls back the preference update", async () => {
  reset({ id: "admin-1", role: "SUPER_ADMIN" });
  globalThis.__displayStudioDbState.auditFailure = true;
  const request = new Request("http://localhost/api/display-studio", {
    method: "PUT",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({ preferences: validPreferences() }),
  });

  const response = await PUT(request);

  assert.equal(response.status, 500);
  assert.equal(globalThis.__displayStudioDbState.preferences, null);
  assert.equal(globalThis.__displayStudioDbState.auditRecords.length, 0);
});
