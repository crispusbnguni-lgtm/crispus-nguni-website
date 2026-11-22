import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

function clone(value) {
  return structuredClone(value);
}

globalThis.__backgroundState = { rows: [], auditRecords: [] };
globalThis.__backgroundEvents = [];
globalThis.__backgroundAuditCalls = [];
globalThis.__backgroundAuthCalls = 0;
globalThis.__backgroundPermissions = [];
globalThis.__backgroundActorCalls = 0;
globalThis.__backgroundAuthorized = true;
globalThis.__backgroundAuditFailure = false;
globalThis.__backgroundMutationFailure = false;
globalThis.__backgroundConstraintFailure = false;
globalThis.__backgroundNextId = 1;
globalThis.__backgroundLockTail = Promise.resolve();

const trustedActor = Object.freeze({ userId: "verified-server-admin", role: "SUPER_ADMIN" });

async function acquireAdvisoryLock() {
  const previous = globalThis.__backgroundLockTail;
  let release;
  globalThis.__backgroundLockTail = new Promise((resolve) => {
    release = resolve;
  });
  await previous;
  return release;
}

globalThis.__backgroundPrisma = {
  async backgroundFindMany() {
    globalThis.__backgroundEvents.push("background.findMany");
    return clone(globalThis.__backgroundState.rows).sort((a, b) =>
      a.sortOrder - b.sortOrder || b.createdAt.localeCompare(a.createdAt),
    );
  },
  async $transaction(callback) {
    let working = clone(globalThis.__backgroundState);
    let releaseLock;
    let lockAcquired = false;

    const tx = {
      async $executeRaw(strings, ...values) {
        globalThis.__backgroundEvents.push("transaction.advisoryLock");
        assert.match(strings.join("?"), /pg_advisory_xact_lock/);
        assert.equal(values.length, 0);
        if (!lockAcquired) {
          releaseLock = await acquireAdvisoryLock();
          lockAcquired = true;
          // A transaction waiting for the advisory lock observes the latest committed state.
          working = clone(globalThis.__backgroundState);
        }
        return 1;
      },
      backgroundOption: {
        async findUnique({ where }) {
          globalThis.__backgroundEvents.push("background.findUnique");
          return clone(working.rows.find((row) => row.id === where.id) ?? null);
        },
        async findMany({ where }) {
          globalThis.__backgroundEvents.push("background.findMany.tx");
          return clone(working.rows.filter((row) => where.isDefault === undefined || row.isDefault === where.isDefault));
        },
        async updateMany({ where, data }) {
          globalThis.__backgroundEvents.push("background.updateMany");
          if (globalThis.__backgroundMutationFailure) throw new Error("simulated mutation failure");
          let count = 0;
          for (const row of working.rows) {
            if (
              (where.isDefault === undefined || row.isDefault === where.isDefault) &&
              (!where.id?.not || row.id !== where.id.not)
            ) {
              Object.assign(row, clone(data));
              count += 1;
            }
          }
          return { count };
        },
        async create({ data }) {
          globalThis.__backgroundEvents.push("background.create");
          if (globalThis.__backgroundMutationFailure) throw new Error("simulated mutation failure");
          const row = {
            id: `created-background-${globalThis.__backgroundNextId++}`,
            ...clone(data),
            sortOrder: data.sortOrder ?? 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          working.rows.push(row);
          return clone(row);
        },
        async update({ where, data }) {
          globalThis.__backgroundEvents.push("background.update");
          if (globalThis.__backgroundMutationFailure) throw new Error("simulated mutation failure");
          const row = working.rows.find((candidate) => candidate.id === where.id);
          if (!row) throw Object.assign(new Error("missing row"), { code: "P2025" });
          Object.assign(row, clone(data), { updatedAt: new Date().toISOString() });
          return clone(row);
        },
        async delete({ where }) {
          globalThis.__backgroundEvents.push("background.delete");
          if (globalThis.__backgroundMutationFailure) throw new Error("simulated mutation failure");
          const index = working.rows.findIndex((candidate) => candidate.id === where.id);
          if (index < 0) throw Object.assign(new Error("missing row"), { code: "P2025" });
          return clone(working.rows.splice(index, 1)[0]);
        },
      },
      auditLog: {
        async create({ data }) {
          globalThis.__backgroundEvents.push("audit.create");
          if (globalThis.__backgroundAuditFailure) throw new Error("simulated audit failure");
          working.auditRecords.push(clone(data));
          return data;
        },
      },
    };

    try {
      const result = await callback(tx);
      assert.equal(lockAcquired, true, "every background mutation transaction must take the invariant lock");
      if (globalThis.__backgroundConstraintFailure) {
        throw Object.assign(new Error("simulated unique index conflict"), { code: "P2002" });
      }
      if (working.rows.filter((row) => row.isDefault).length > 1) {
        throw Object.assign(new Error("simulated partial unique index conflict"), { code: "P2002" });
      }
      globalThis.__backgroundState = working;
      return result;
    } finally {
      releaseLock?.();
    }
  },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") {
      return {
        url: dataModule(`
          export const NextResponse = {
            json(body, init = {}) {
              return new Response(JSON.stringify(body), {
                status: init.status ?? 200,
                headers: init.headers,
              });
            }
          };
        `),
        shortCircuit: true,
      };
    }
    if (specifier === "server-only") {
      return { url: dataModule("export {};"), shortCircuit: true };
    }
    if (specifier === "@/lib/prisma") {
      return {
        url: dataModule(`
          export const prisma = {
            backgroundOption: { findMany: (...args) => globalThis.__backgroundPrisma.backgroundFindMany(...args) },
            $transaction: (...args) => globalThis.__backgroundPrisma.$transaction(...args),
          };
        `),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/authorization") {
      return {
        url: dataModule(`
          export async function requireApiPermission(permission) {
            globalThis.__backgroundAuthCalls += 1;
            globalThis.__backgroundPermissions.push(permission);
            if (!globalThis.__backgroundAuthorized) {
              return {
                user: null,
                response: new Response(JSON.stringify({ success: false, message: "Super Admin access required." }), { status: 403 }),
              };
            }
            return { user: { id: "verified-server-admin", role: "SUPER_ADMIN" }, response: null };
          }
          export function requireSameOriginApiRequest(request) {
            try {
              const origin = request.headers.get("origin");
              return origin && new URL(origin).origin === origin && origin === new URL(request.url).origin
                ? null
                : Response.json({ success: false }, { status: 403 });
            } catch {
              return Response.json({ success: false }, { status: 403 });
            }
          }
        `),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/admin-audit") {
      return {
        url: dataModule(`
          export async function resolveAdminAuditActor() {
            globalThis.__backgroundActorCalls += 1;
            return globalThis.__backgroundTrustedActor;
          }
          export async function writeAdminAudit(actor, input, tx) {
            globalThis.__backgroundAuditCalls.push({ actor, input, tx });
            if (globalThis.__backgroundAuditFailure) throw new Error("simulated audit failure");
            const metadata = {
              ...(input.metadata ?? {}),
              ...(input.reason ? { reason: input.reason } : {}),
              ...(input.outcome ? { outcome: input.outcome } : {}),
            };
            await tx.auditLog.create({
              data: {
                eventId: "mock-event-id",
                actorUserId: actor.userId,
                action: input.action,
                targetType: input.targetType ?? null,
                targetId: input.targetId ?? null,
                metadata,
              },
            });
          }
        `),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/background-governance") {
      return {
        url: new URL("../src/lib/background-governance.ts", import.meta.url).href,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

globalThis.__backgroundTrustedActor = trustedActor;

const { POST: createBackground } = await import("../src/app/api/admin/backgrounds/route.ts");
const { PATCH: updateBackground, DELETE: deleteBackground } = await import("../src/app/api/admin/backgrounds/[id]/route.ts");

function reset(rows = []) {
  globalThis.__backgroundState = { rows: clone(rows), auditRecords: [] };
  globalThis.__backgroundEvents.length = 0;
  globalThis.__backgroundAuditCalls.length = 0;
  globalThis.__backgroundAuthCalls = 0;
  globalThis.__backgroundPermissions.length = 0;
  globalThis.__backgroundActorCalls = 0;
  globalThis.__backgroundAuthorized = true;
  globalThis.__backgroundAuditFailure = false;
  globalThis.__backgroundMutationFailure = false;
  globalThis.__backgroundConstraintFailure = false;
  globalThis.__backgroundNextId = 1;
  globalThis.__backgroundLockTail = Promise.resolve();
}

function makeRow(id, overrides = {}) {
  return {
    id,
    name: `Background ${id}`,
    type: "COLOR",
    value: "#123456",
    description: "Private description",
    enabled: true,
    isDefault: false,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function request(method, body) {
  return new Request("https://example.test/api/admin/backgrounds", {
    method,
    headers: {
      origin: "https://example.test",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
        }),
  });
}

const routeContext = (id) => ({ params: Promise.resolve({ id }) });
const readJson = async (response) => response.json();

function assertAudit({ action, targetId, changedFields }) {
  assert.equal(globalThis.__backgroundAuditCalls.length, 1);
  const call = globalThis.__backgroundAuditCalls[0];
  assert.equal(call.actor, trustedActor);
  assert.equal(call.input.action, action);
  assert.equal(call.input.targetType, "BackgroundOption");
  assert.equal(call.input.targetId, targetId);
  assert.deepEqual(call.input.metadata?.changedFields, changedFields);
  assert.equal(call.input.reason, "ADMIN_REQUEST");
  assert.equal(call.input.outcome, "SUCCEEDED");
  assert.equal(call.tx.backgroundOption !== undefined, true);
  const serialized = JSON.stringify(call.input);
  for (const secret of ["#123456", "https://private.example/", "Private description"]) {
    assert.equal(serialized.includes(secret), false);
  }
}

test("creation and its audit commit together without recording values or descriptions", async () => {
  reset();
  const response = await createBackground(request("POST", {
    name: "Sunset",
    type: "IMAGE",
    value: "https://private.example/sunset.jpg",
    description: "Private description",
    enabled: true,
    isDefault: false,
  }));
  assert.equal(response.status, 201);
  const body = await readJson(response);
  assert.equal(body.background.id, "created-background-1");
  assert.equal(globalThis.__backgroundState.auditRecords.length, 1);
  assertAudit({
    action: "ADMIN_BACKGROUND_CREATED",
    targetId: body.background.id,
    changedFields: ["name", "type", "value", "description", "enabled", "isDefault"],
  });
  assert.deepEqual(globalThis.__backgroundEvents.slice(0, 3), [
    "transaction.advisoryLock",
    "background.create",
    "audit.create",
  ]);
});

test("creation marked default clears the prior default in the same transaction", async () => {
  reset([makeRow("old-default", { isDefault: true })]);
  const response = await createBackground(request("POST", {
    name: "New default",
    type: "COLOR",
    value: "#ABCDEF",
    isDefault: true,
  }));
  assert.equal(response.status, 201);
  assert.equal(globalThis.__backgroundState.rows.filter((row) => row.isDefault).length, 1);
  assert.equal(globalThis.__backgroundState.rows.find((row) => row.id === "old-default").isDefault, false);
  assertAudit({
    action: "ADMIN_BACKGROUND_CREATED",
    targetId: "created-background-1",
    changedFields: ["name", "type", "value", "description", "enabled", "isDefault"],
  });
});

test("normal updates audit only changed field names", async () => {
  reset([makeRow("background-1")]);
  const response = await updateBackground(request("PATCH", { name: "Updated title", sortOrder: 4 }), routeContext("background-1"));
  assert.equal(response.status, 200);
  const body = await readJson(response);
  assert.equal(body.background.name, "Updated title");
  assert.equal(body.background.sortOrder, 4);
  assertAudit({ action: "ADMIN_BACKGROUND_UPDATED", targetId: "background-1", changedFields: ["name", "sortOrder"] });
});

test("default switching audits the selected row and leaves exactly one default", async () => {
  reset([
    makeRow("old-default", { isDefault: true }),
    makeRow("next-default"),
  ]);
  const response = await updateBackground(request("PATCH", { isDefault: true }), routeContext("next-default"));
  assert.equal(response.status, 200);
  assert.equal(globalThis.__backgroundState.rows.find((row) => row.id === "old-default").isDefault, false);
  assert.equal(globalThis.__backgroundState.rows.find((row) => row.id === "next-default").isDefault, true);
  assert.equal(globalThis.__backgroundState.rows.filter((row) => row.isDefault).length, 1);
  assertAudit({ action: "ADMIN_BACKGROUND_UPDATED", targetId: "next-default", changedFields: ["isDefault"] });
});

test("successful deletion removes the row and audits its identifier without its contents", async () => {
  reset([makeRow("delete-me")]);
  const response = await deleteBackground(request("DELETE"), routeContext("delete-me"));
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { success: true });
  assert.equal(globalThis.__backgroundState.rows.length, 0);
  assertAudit({ action: "ADMIN_BACKGROUND_DELETED", targetId: "delete-me", changedFields: undefined });
  assert.equal("metadata" in globalThis.__backgroundAuditCalls[0].input, false);
});

test("deleting the default background is rejected without mutation or audit", async () => {
  reset([makeRow("default-row", { isDefault: true })]);
  const response = await deleteBackground(request("DELETE"), routeContext("default-row"));
  assert.equal(response.status, 400);
  assert.equal(globalThis.__backgroundState.rows.length, 1);
  assert.equal(globalThis.__backgroundState.rows[0].isDefault, true);
  assert.equal(globalThis.__backgroundState.auditRecords.length, 0);
  assert.equal(globalThis.__backgroundAuditCalls.length, 0);
});

test("missing rows preserve 404 responses and write no audit", async () => {
  reset();
  const patched = await updateBackground(request("PATCH", { name: "x" }), routeContext("missing"));
  const deleted = await deleteBackground(request("DELETE"), routeContext("missing"));
  assert.equal(patched.status, 404);
  assert.equal(deleted.status, 404);
  assert.equal(globalThis.__backgroundAuditCalls.length, 0);
  assert.equal(globalThis.__backgroundState.auditRecords.length, 0);
});

test("audit failure rolls back background creation", async () => {
  reset();
  globalThis.__backgroundAuditFailure = true;
  const response = await createBackground(request("POST", {
    name: "New",
    type: "COLOR",
    value: "#123456",
  }));
  assert.equal(response.status, 500);
  assert.equal(globalThis.__backgroundState.rows.length, 0);
  assert.equal(globalThis.__backgroundState.auditRecords.length, 0);
});

test("audit failure rolls back background updates", async () => {
  const original = makeRow("row");
  reset([original]);
  globalThis.__backgroundAuditFailure = true;
  const response = await updateBackground(request("PATCH", { name: "Changed" }), routeContext("row"));
  assert.equal(response.status, 500);
  assert.deepEqual(globalThis.__backgroundState.rows, [original]);
  assert.equal(globalThis.__backgroundState.auditRecords.length, 0);
});

test("audit failure rolls back background deletion", async () => {
  const original = makeRow("row");
  reset([original]);
  globalThis.__backgroundAuditFailure = true;
  const response = await deleteBackground(request("DELETE"), routeContext("row"));
  assert.equal(response.status, 500);
  assert.deepEqual(globalThis.__backgroundState.rows, [original]);
  assert.equal(globalThis.__backgroundState.auditRecords.length, 0);
});

test("all mutation routes require API Super Admin authorization and ignore browser actor fields", async () => {
  reset([makeRow("row")]);
  globalThis.__backgroundAuthorized = false;
  const responses = await Promise.all([
    createBackground(request("POST", { name: "x", type: "COLOR", value: "#123456", actorId: "browser-user", role: "SUPER_ADMIN" })),
    updateBackground(request("PATCH", { name: "x", actorId: "browser-user", role: "SUPER_ADMIN" }), routeContext("row")),
    deleteBackground(request("DELETE"), routeContext("row")),
  ]);
  assert.deepEqual(responses.map((response) => response.status), [403, 403, 403]);
  assert.equal(globalThis.__backgroundAuthCalls, 3);
  assert.equal(globalThis.__backgroundActorCalls, 0);
  assert.equal(globalThis.__backgroundEvents.length, 0);
  assert.equal(globalThis.__backgroundState.auditRecords.length, 0);
});

test("authenticated mutations attribute audits to the verified actor despite forged actor fields", async () => {
  reset([makeRow("update-target"), makeRow("delete-target")]);
  const forgedActorFields = {
    actorId: "forged-actor-id",
    actorUserId: "forged-actor-user-id",
    userId: "forged-user-id",
    email: "forged@example.invalid",
    role: "SUPER_ADMIN",
    authMethod: "GOOGLE",
    primaryAuthMethod: "PASSKEY",
  };

  const created = await createBackground(request("POST", {
    ...forgedActorFields,
    name: "Audited image",
    type: "IMAGE",
    value: "https://private.example/background.jpg",
  }));
  const createdBody = await readJson(created);
  const updated = await updateBackground(request("PATCH", {
    ...forgedActorFields,
    name: "Updated image",
    type: "IMAGE",
    value: "https://private.example/updated-background.jpg",
  }), routeContext("update-target"));
  const deleted = await deleteBackground(request("DELETE", forgedActorFields), routeContext("delete-target"));

  assert.deepEqual([created.status, updated.status, deleted.status], [201, 200, 200]);
  assert.equal(globalThis.__backgroundActorCalls, 3);
  assert.equal(globalThis.__backgroundAuditCalls.length, 3);
  for (const call of globalThis.__backgroundAuditCalls) {
    assert.equal(call.actor, trustedActor);
    assert.equal(call.input.targetType, "BackgroundOption");
    assert.equal(call.tx.backgroundOption !== undefined, true);
  }

  assert.deepEqual(
    globalThis.__backgroundAuditCalls.map(({ input }) => input.targetId),
    [createdBody.background.id, "update-target", "delete-target"],
  );
  assert.deepEqual(
    globalThis.__backgroundState.auditRecords.map(({ actorUserId, targetId }) => ({ actorUserId, targetId })),
    [
      { actorUserId: trustedActor.userId, targetId: createdBody.background.id },
      { actorUserId: trustedActor.userId, targetId: "update-target" },
      { actorUserId: trustedActor.userId, targetId: "delete-target" },
    ],
  );

  const auditData = JSON.stringify(globalThis.__backgroundAuditCalls.map(({ input }) => input));
  const persistedAudit = JSON.stringify(globalThis.__backgroundState.auditRecords);
  for (const sensitiveValue of [
    forgedActorFields.email,
    forgedActorFields.actorId,
    forgedActorFields.actorUserId,
    forgedActorFields.userId,
    forgedActorFields.authMethod,
    forgedActorFields.primaryAuthMethod,
    "https://private.example/background.jpg",
    "https://private.example/updated-background.jpg",
  ]) {
    assert.equal(auditData.includes(sensitiveValue), false);
    assert.equal(persistedAudit.includes(sensitiveValue), false);
  }
  assert.deepEqual(globalThis.__backgroundAuditCalls[0].input.metadata.changedFields, [
    "name", "type", "value", "description", "enabled", "isDefault",
  ]);
  assert.deepEqual(globalThis.__backgroundAuditCalls[1].input.metadata.changedFields, [
    "name", "type", "value",
  ]);
  assert.equal("metadata" in globalThis.__backgroundAuditCalls[2].input, false);
});

test("invalid create and update inputs do not mutate or write success audits", async () => {
  reset([makeRow("row")]);
  const invalidCreate = await createBackground(request("POST", {
    name: "bad",
    type: "IMAGE",
    value: "http://insecure.example/image.png",
  }));
  const invalidUpdate = await updateBackground(request("PATCH", { sortOrder: -1 }), routeContext("row"));
  assert.equal(invalidCreate.status, 400);
  assert.equal(invalidUpdate.status, 400);
  assert.equal(globalThis.__backgroundAuditCalls.length, 0);
  assert.equal(globalThis.__backgroundState.auditRecords.length, 0);
  assert.equal(globalThis.__backgroundState.rows[0].sortOrder, 0);
});

test("concurrent default switches serialize and retain exactly one default", async () => {
  reset([makeRow("first"), makeRow("second")]);
  const [first, second] = await Promise.all([
    updateBackground(request("PATCH", { isDefault: true }), routeContext("first")),
    updateBackground(request("PATCH", { isDefault: true }), routeContext("second")),
  ]);
  assert.deepEqual([first.status, second.status], [200, 200]);
  assert.equal(globalThis.__backgroundState.rows.filter((row) => row.isDefault).length, 1);
  assert.equal(globalThis.__backgroundState.auditRecords.length, 2);
  assert.equal(globalThis.__backgroundEvents.filter((event) => event === "transaction.advisoryLock").length, 2);
});

test("switching the default and deleting the former default cannot race past the invariant lock", async () => {
  reset([
    makeRow("former-default", { isDefault: true }),
    makeRow("replacement"),
  ]);
  const [switchResponse, deleteResponse] = await Promise.all([
    updateBackground(request("PATCH", { isDefault: true }), routeContext("replacement")),
    deleteBackground(request("DELETE"), routeContext("former-default")),
  ]);
  assert.equal(switchResponse.status, 200);
  assert.ok([200, 400].includes(deleteResponse.status));
  const remainingDefaults = globalThis.__backgroundState.rows.filter((row) => row.isDefault);
  assert.equal(remainingDefaults.length, 1);
  assert.equal(remainingDefaults[0].id, "replacement");
  if (deleteResponse.status === 200) {
    assert.equal(globalThis.__backgroundState.rows.some((row) => row.id === "former-default"), false);
  }
});

test("database uniqueness conflicts return 409 and are not reported as success", async () => {
  reset([makeRow("row")]);
  globalThis.__backgroundConstraintFailure = true;
  const response = await updateBackground(request("PATCH", { name: "Changed" }), routeContext("row"));
  assert.equal(response.status, 409);
  assert.equal(globalThis.__backgroundState.rows[0].name, "Background row");
  assert.equal(globalThis.__backgroundState.auditRecords.length, 0);
});

test("schema and additive migration declare a partial unique index guarded against duplicate existing defaults", async () => {
  const [schema, migration] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20261111130000_enforce_background_single_default/migration.sql", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /previewFeatures\s*=\s*\["partialIndexes"\]/);
  assert.match(schema, /@@unique\(\[isDefault\],\s*where:\s*\{\s*isDefault:\s*true\s*\},\s*map:\s*"BackgroundOption_single_default_idx"\)/);
  assert.match(migration, /COUNT\(\*\)[\s\S]*WHERE "isDefault" = true[\s\S]*> 1/);
  assert.match(migration, /CREATE UNIQUE INDEX "BackgroundOption_single_default_idx"[\s\S]*WHERE "isDefault" = true/);
  assert.doesNotMatch(migration, /\b(DELETE|UPDATE|ALTER|DROP)\b/i);
});
