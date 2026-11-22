import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { randomUUID } from "node:crypto";

const testDatabaseUrl = process.env.SECURITY_VAULT_TEST_DATABASE_URL;
let safeDatabaseUrl = null;
if (testDatabaseUrl) {
  let parsed;
  try {
    parsed = new URL(testDatabaseUrl);
  } catch {
    throw new Error("SECURITY_VAULT_TEST_DATABASE_URL must be a valid URL; refusing to connect.");
  }
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (parsed.protocol !== "postgresql:" || !loopbackHosts.has(parsed.hostname) || parsed.pathname.replace(/^\//, "") !== "security_vault_test") {
    throw new Error("Vault integration tests only connect to a loopback PostgreSQL database named security_vault_test; refusing this target.");
  }
  safeDatabaseUrl = testDatabaseUrl;
}

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") {
      return { url: dataModule("export class NextResponse extends Response { static json(body, init = {}) { return Response.json(body, init); } }"), shortCircuit: true };
    }
    if (specifier === "@/lib/prisma" && context.parentURL?.endsWith("/src/app/api/dashboard/workspace/security/vault/route.ts")) {
      return { url: dataModule("export const prisma = globalThis.__vaultIntegrationPrisma;"), shortCircuit: true };
    }
    if (specifier === "@/lib/authorization" && context.parentURL?.endsWith("/src/app/api/dashboard/workspace/security/vault/route.ts")) {
      return { url: dataModule("export async function requireApiUser() { return { user: { id: globalThis.__vaultIntegrationUserId }, response: null }; } export function requireSameOriginApiRequest() { return null; }"), shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const unavailableReason = "No explicit loopback SECURITY_VAULT_TEST_DATABASE_URL is configured; refusing to use the app's remote datasource.";
test("vault database isolation, compare-and-swap, rollback, and cascade integration", { skip: safeDatabaseUrl ? false : unavailableReason }, async (t) => {
  const [{ PrismaClient }, { PrismaPg }] = await Promise.all([
    import("@prisma/client"),
    import("@prisma/adapter-pg"),
  ]);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: safeDatabaseUrl }) });
  let identity;
  try {
    [identity] = await db.$queryRawUnsafe("SELECT current_database() AS database, inet_server_addr()::text AS server_address");
  } catch {
    await db.$disconnect();
    throw new Error("Could not verify the isolated test database identity; refusing to run integration writes.");
  }
  const localServer = identity?.server_address === "::1" || identity?.server_address === "0:0:0:0:0:0:0:1" || /^127(?:\.\d{1,3}){3}$/.test(identity?.server_address ?? "");
  if (identity?.database !== "security_vault_test" || !localServer) {
    await db.$disconnect();
    throw new Error("Connected PostgreSQL identity is not the required local security_vault_test database; refusing integration writes.");
  }
  globalThis.__vaultIntegrationPrisma = db;
  const { GET, POST, PUT } = await import("../src/app/api/dashboard/workspace/security/vault/route.ts");
  const userIds = [];
  const workspaces = [];
  const recordsPayload = (recordId, marker) => [{ id: recordId, nonce: Buffer.alloc(12, marker).toString("base64"), ciphertext: Buffer.alloc(48, marker).toString("base64") }];
  const apiRequest = (method, body) => new Request("http://localhost/api/dashboard/workspace/security/vault", {
    method,
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const setUser = (id) => { globalThis.__vaultIntegrationUserId = id; };
  const createOwner = async () => {
    const id = randomUUID();
    const user = await db.user.create({ data: { id, email: `${id}@example.test` }, select: { id: true } });
    userIds.push(user.id);
    const workspace = await db.personalWorkspace.create({ data: { userId: user.id }, select: { id: true } });
    workspaces.push(workspace.id);
    return user.id;
  };
  const createVault = async (ownerId) => {
    const vaultId = randomUUID();
    setUser(ownerId);
    const payload = {
      vaultId, formatVersion: 1, kdfAlgorithm: "argon2id", kdfMemoryKiB: 65_536, kdfIterations: 3, kdfParallelism: 1,
      masterSalt: Buffer.alloc(16, 1).toString("base64"), masterNonce: Buffer.alloc(12, 2).toString("base64"), masterWrappedDataKey: Buffer.alloc(48, 3).toString("base64"),
      recoverySalt: Buffer.alloc(16, 4).toString("base64"), recoveryNonce: Buffer.alloc(12, 5).toString("base64"), recoveryWrappedDataKey: Buffer.alloc(48, 6).toString("base64"),
    };
    const response = await POST(apiRequest("POST", payload));
    assert.equal(response.status, 201);
    return vaultId;
  };

  try {
    const ownerA = await createOwner();
    const ownerB = await createOwner();
    const vaultId = await createVault(ownerA);
    const initialRecordId = "record_initial_01";
    let response = await PUT(apiRequest("PUT", { vaultId, expectedRevision: 1, records: recordsPayload(initialRecordId, 7) }));
    assert.equal(response.status, 200);

    await t.test("cross-user and unauthorized vault or record updates are denied", async () => {
      setUser(ownerB);
      response = await GET();
      assert.equal(response.status, 200);
      const hidden = await response.json();
      assert.equal(hidden.vault, null);
      response = await PUT(apiRequest("PUT", { vaultId, expectedRevision: 2, records: recordsPayload("record_attacker_01", 8) }));
      assert.equal(response.status, 409);
      const attackerOwnedVault = await createVault(ownerB);
      assert.notEqual(attackerOwnedVault, vaultId);
      const ownerWorkspace = await db.personalWorkspace.findUnique({ where: { userId: ownerB }, select: { id: true } });
      assert.ok(ownerWorkspace);
      response = await PUT(apiRequest("PUT", { vaultId, expectedRevision: 2, records: recordsPayload("record_attacker_02", 9) }));
      assert.equal(response.status, 409);
      const ownerRows = await db.securityVaultRecord.findMany({ where: { vaultId } });
      assert.deepEqual(ownerRows.map((row) => row.id), [initialRecordId]);
      const malformed = await PUT(apiRequest("PUT", { vaultId, expectedRevision: 2, records: [{ id: "record_bad_0001", nonce: "bad", ciphertext: "bad" }] }));
      assert.equal(malformed.status, 400);
    });

    setUser(ownerA);
    await t.test("stale revision and concurrent updates cannot overwrite a newer restore", async () => {
      response = await PUT(apiRequest("PUT", { vaultId, expectedRevision: 2, records: recordsPayload("record_restored_01", 10) }));
      assert.equal(response.status, 200);
      const staleRestore = await PUT(apiRequest("PUT", { vaultId, expectedRevision: 2, records: recordsPayload("record_stale_0001", 11) }));
      assert.equal(staleRestore.status, 409);
      const beforeRace = 3;
      const race = await Promise.all([
        PUT(apiRequest("PUT", { vaultId, expectedRevision: beforeRace, records: recordsPayload("record_race_a_01", 12) })),
        PUT(apiRequest("PUT", { vaultId, expectedRevision: beforeRace, records: recordsPayload("record_race_b_01", 13) })),
      ]);
      assert.equal(race.filter((result) => result.status === 200).length, 1);
      const persisted = await db.securityVault.findUnique({ where: { id: vaultId }, include: { records: true } });
      assert.equal(persisted.revision, beforeRace + 1);
      assert.equal(persisted.records.length, 1);
      assert.ok(["record_race_a_01", "record_race_b_01"].includes(persisted.records[0].id));
    });

    await t.test("validation and persistence failures leave revision and records unchanged", async () => {
      const before = await db.securityVault.findUnique({ where: { id: vaultId }, include: { records: true } });
      const invalidRequest = await PUT(apiRequest("PUT", { vaultId, expectedRevision: before.revision, records: [{ id: "record_bad_0002", nonce: "bad", ciphertext: "bad" }] }));
      assert.equal(invalidRequest.status, 400);
      await assert.rejects(db.$transaction(async (tx) => {
        await tx.securityVault.update({ where: { id: vaultId }, data: { revision: { increment: 1 } } });
        await tx.securityVaultRecord.deleteMany({ where: { vaultId } });
        await tx.securityVaultRecord.createMany({ data: [{ vaultId, id: "x".repeat(81), nonce: Buffer.alloc(12).toString("base64"), ciphertext: Buffer.alloc(48).toString("base64") }] });
      }));
      const after = await db.securityVault.findUnique({ where: { id: vaultId }, include: { records: true } });
      assert.equal(after.revision, before.revision);
      assert.deepEqual(after.records.map((row) => row.id), before.records.map((row) => row.id));
      assert.deepEqual(Object.keys(after.records[0]).sort(), ["ciphertext", "createdAt", "id", "nonce", "updatedAt", "vaultId"].sort());
    });

    await t.test("workspace deletion cascades to vault metadata and encrypted records", async () => {
      const workspaceId = workspaces[0];
      await db.personalWorkspace.delete({ where: { id: workspaceId } });
      workspaces.splice(workspaces.indexOf(workspaceId), 1);
      assert.equal(await db.securityVault.findUnique({ where: { id: vaultId } }), null);
      assert.equal(await db.securityVaultRecord.count({ where: { vaultId } }), 0);
    });
  } finally {
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
    delete globalThis.__vaultIntegrationPrisma;
    delete globalThis.__vaultIntegrationUserId;
  }
});
