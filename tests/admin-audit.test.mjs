import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

globalThis.__adminAuditUser = { id: "admin_123456", role: "SUPER_ADMIN" };
globalThis.__adminAuditWrites = [];
globalThis.__adminAuditPrisma = {
  auditLog: {
    async create(args) {
      globalThis.__adminAuditWrites.push(args.data);
      return args.data;
    },
  },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: dataModule(""), shortCircuit: true };
    }
    if (specifier === "@/lib/auth") {
      return {
        url: dataModule("export async function getCurrentUser() { return globalThis.__adminAuditUser; }") ,
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/prisma") {
      return {
        url: dataModule("export const prisma = globalThis.__adminAuditPrisma;"),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/mfa-challenges-core") {
      return {
        url: dataModule("export function isTrustedPendingMfaChallenge() { return false; }"),
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const {
  ADMIN_AUDIT_ACTIONS,
  isAdminAuditAction,
  resolveAdminAuditActor,
  resolveSecurityAuditActor,
  writeAdminAudit,
  writeSecurityAudit,
} = await import("../src/lib/admin-audit.ts");

function reset() {
  globalThis.__adminAuditWrites.length = 0;
  globalThis.__adminAuditUser = { id: "admin_123456", role: "SUPER_ADMIN" };
}

test("administrative actions are finite and unknown actions are rejected", async () => {
  reset();
  assert.ok(ADMIN_AUDIT_ACTIONS.length > 0);
  assert.equal(isAdminAuditAction("ADMIN_ACCOUNT_SUSPENDED"), true);
  assert.equal(isAdminAuditAction("ADMIN_ACCOUNT_VERIFICATION_REJECTED"), true);
  assert.equal(isAdminAuditAction("ADMIN_ALL_SESSIONS_REVOKED"), true);
  assert.equal(isAdminAuditAction("ARBITRARY_ACTION"), false);

  const actor = await resolveAdminAuditActor();
  await assert.rejects(
    writeAdminAudit(actor, { action: "ARBITRARY_ACTION" }),
    /Unsupported administrative audit action/,
  );
  assert.equal(globalThis.__adminAuditWrites.length, 0);
});

test("administrative action reason is bounded, persisted as safe metadata, and rejects contact details", async () => {
  reset();
  const actor = await resolveAdminAuditActor();
  await writeAdminAudit(actor, {
    action: "ADMIN_ACCOUNT_SUSPENDED",
    targetType: "User",
    targetId: "user_123456",
    metadata: { actionReason: "Policy review case 4821" },
    reason: "ADMIN_REQUEST",
    outcome: "SUCCEEDED",
  });
  assert.equal(globalThis.__adminAuditWrites[0].metadata.actionReason, "Policy review case 4821");
  await assert.rejects(writeAdminAudit(actor, {
    action: "ADMIN_ACCOUNT_SUSPENDED",
    metadata: { actionReason: "Contact user@example.test" },
  }), /Invalid administrative action reason/);
  assert.equal(globalThis.__adminAuditWrites.length, 1);
});

test("MFA lifecycle events use a trusted authenticated-user writer, not the admin writer", async () => {
  reset();
  globalThis.__adminAuditUser = { id: "user_123456", role: "USER" };
  const actor = await resolveSecurityAuditActor();
  await writeSecurityAudit(actor, {
    action: "AUTH_MFA_ENROLLMENT_COMPLETED",
    targetType: "User",
    targetId: "user_123456",
    outcome: "SUCCEEDED",
  });
  assert.equal(globalThis.__adminAuditWrites.length, 1);
  assert.equal(globalThis.__adminAuditWrites[0].actorUserId, "user_123456");
  assert.equal(globalThis.__adminAuditWrites[0].action, "AUTH_MFA_ENROLLMENT_COMPLETED");

  globalThis.__adminAuditUser = { id: "admin_123456", role: "SUPER_ADMIN" };
  const adminActor = await resolveAdminAuditActor();
  await assert.rejects(
    writeAdminAudit(adminActor, { action: "AUTH_MFA_CHALLENGE_COMPLETED" }),
    /trusted security writer/,
  );
  await assert.rejects(
    writeSecurityAudit({ userId: "forged", role: "USER" }, { action: "AUTH_MFA_DISABLED" }),
    /server-verified security actor/,
  );
  assert.equal(globalThis.__adminAuditWrites.length, 1);
});

test("actor context is resolved from the server session and cannot be forged structurally", async () => {
  reset();
  const actor = await resolveAdminAuditActor();
  assert.equal(actor.userId, "admin_123456");
  assert.equal(actor.role, "SUPER_ADMIN");

  await assert.rejects(
    writeAdminAudit({ userId: "attacker", role: "SUPER_ADMIN" }, { action: "ADMIN_ACCOUNT_VIEWED" }),
    /server-verified administrative actor/,
  );

  globalThis.__adminAuditUser = { id: "user_123456", role: "USER" };
  await assert.rejects(resolveAdminAuditActor(), /authorization required/);
  globalThis.__adminAuditUser = null;
  await assert.rejects(resolveAdminAuditActor(), /authorization required/);
  assert.equal(globalThis.__adminAuditWrites.length, 0);
});

test("allowlisted metadata is bounded and sensitive device labels are redacted", async () => {
  reset();
  const actor = await resolveAdminAuditActor();
  await writeAdminAudit(actor, {
    action: "ADMIN_SESSION_REVOKED",
    targetType: "UserSession",
    targetId: "session_1",
    metadata: {
      deviceLabel: "Alice alice@example.com browser",
      revokedCount: 1,
      changedFields: ["revokedAt"],
    },
    reason: "SECURITY_RESPONSE",
    outcome: "SUCCEEDED",
  });
  const record = globalThis.__adminAuditWrites[0];
  assert.equal(record.metadata.deviceLabel, "[REDACTED]");
  assert.equal(record.metadata.revokedCount, 1);
  assert.equal(record.metadata.reason, "SECURITY_RESPONSE");
  assert.match(record.eventId, /^[0-9a-f-]{36}$/i);

  await assert.rejects(
    writeAdminAudit(actor, {
      action: "ADMIN_ACCOUNT_VIEWED",
      metadata: { email: "alice@example.com" },
    }),
    /unsupported fields/,
  );
  await assert.rejects(
    writeAdminAudit(actor, {
      action: "ADMIN_ACCOUNT_VIEWED",
      metadata: { rawError: "database failure" },
    }),
    /unsupported fields/,
  );
  await assert.rejects(
    writeAdminAudit(actor, {
      action: "ADMIN_ACCOUNT_VIEWED",
      metadata: { deviceLabel: "x".repeat(201) },
    }),
    /Invalid device label/,
  );
  await assert.rejects(
    writeAdminAudit(actor, {
      action: "ADMIN_ACCOUNT_VIEWED",
      metadata: { changedFields: ["x".repeat(65)] },
    }),
    /Invalid changed-fields/,
  );
  assert.equal(globalThis.__adminAuditWrites.length, 1);
});

test("metadata identifier fields reject phone-like values and retain application ID formats", async () => {
  reset();
  const actor = await resolveAdminAuditActor();
  const phoneLikeValues = ["254712345678", "0712-345-678", "+254 (712) 345 678"];

  for (const key of ["affectedUserId", "portfolioId", "sessionId"]) {
    for (const value of phoneLikeValues) {
      await assert.rejects(
        writeAdminAudit(actor, {
          action: "ADMIN_ACCOUNT_VIEWED",
          metadata: { [key]: value },
        }),
        new RegExp(`Invalid ${key} audit metadata`),
      );
    }
  }

  const validIds = {
    affectedUserId: "user_123456",
    portfolioId: "cm1234567890abcdef12345678",
    sessionId: "session_1",
  };
  await writeAdminAudit(actor, {
    action: "ADMIN_ACCOUNT_VIEWED",
    metadata: validIds,
  });
  assert.deepEqual(globalThis.__adminAuditWrites[0].metadata, validIds);
});

test("login-exemption action remains catalogued but cannot use the generic writer", async () => {
  reset();
  const actor = await resolveAdminAuditActor();
  assert.equal(isAdminAuditAction("SUPER_ADMIN_UNVERIFIED_AUTHENTICATION"), true);
  await assert.rejects(
    writeAdminAudit(actor, { action: "SUPER_ADMIN_UNVERIFIED_AUTHENTICATION" }),
    /dedicated authentication helper/,
  );
  assert.equal(globalThis.__adminAuditWrites.length, 0);
});

test("accessor-backed action input is rejected without invoking a changing getter", async () => {
  reset();
  const actor = await resolveAdminAuditActor();
  let reads = 0;
  const input = {};
  Object.defineProperty(input, "action", {
    enumerable: true,
    get() {
      reads += 1;
      return reads === 1 ? "ADMIN_SESSION_REVOKED" : "SUPER_ADMIN_UNVERIFIED_AUTHENTICATION";
    },
  });

  await assert.rejects(writeAdminAudit(actor, input), /accessor or hidden properties/);
  assert.equal(reads, 0);
  assert.equal(globalThis.__adminAuditWrites.length, 0);
});

test("accessor-backed target IDs are rejected without invoking the getter", async () => {
  reset();
  const actor = await resolveAdminAuditActor();
  let reads = 0;
  const input = { action: "ADMIN_SESSION_REVOKED" };
  Object.defineProperty(input, "targetId", {
    enumerable: true,
    get() {
      reads += 1;
      return reads === 1 ? "session_1" : "254712345678";
    },
  });

  await assert.rejects(writeAdminAudit(actor, input), /accessor or hidden properties/);
  assert.equal(reads, 0);
  assert.equal(globalThis.__adminAuditWrites.length, 0);
});

test("accessor-backed metadata is rejected without invoking metadata getters", async () => {
  reset();
  const actor = await resolveAdminAuditActor();
  let reads = 0;
  const metadata = {};
  Object.defineProperty(metadata, "deviceLabel", {
    enumerable: true,
    get() {
      reads += 1;
      return "Workstation";
    },
  });

  await assert.rejects(
    writeAdminAudit(actor, { action: "ADMIN_ACCOUNT_VIEWED", metadata }),
    /accessor or hidden properties/,
  );
  assert.equal(reads, 0);
  assert.equal(globalThis.__adminAuditWrites.length, 0);
});

test("ordinary plain-data inputs remain accepted", async () => {
  reset();
  const actor = await resolveAdminAuditActor();
  await writeAdminAudit(actor, {
    action: "ADMIN_SESSION_REVOKED",
    targetType: "UserSession",
    targetId: "session_1",
    metadata: { affectedUserId: "user_123456", changedFields: ["revokedAt"] },
    reason: "SECURITY_RESPONSE",
    requestCorrelationId: "b844917d-c828-479b-8229-9d9c31f22d92",
    outcome: "SUCCEEDED",
  });

  assert.equal(globalThis.__adminAuditWrites.length, 1);
  assert.equal(globalThis.__adminAuditWrites[0].targetId, "session_1");
  assert.deepEqual(globalThis.__adminAuditWrites[0].metadata.changedFields, ["revokedAt"]);
});

test("reflective proxy failures are rejected without writing an audit record", async () => {
  reset();
  const actor = await resolveAdminAuditActor();
  const input = new Proxy({}, {
    ownKeys() {
      throw new Error("proxy inspection failure");
    },
  });

  await assert.rejects(writeAdminAudit(actor, input), /could not be safely inspected/);
  assert.equal(globalThis.__adminAuditWrites.length, 0);
});

test("audit insert uses the supplied Prisma transaction client", async () => {
  reset();
  const actor = await resolveAdminAuditActor();
  const transactionWrites = [];
  const transaction = {
    auditLog: {
      async create(args) {
        transactionWrites.push(args.data);
        return args.data;
      },
    },
  };

  const result = await writeAdminAudit(
    actor,
    { action: "ADMIN_ACCOUNT_VERIFIED", targetType: "User", targetId: "user_abcdef" },
    transaction,
  );

  assert.equal(transactionWrites.length, 1);
  assert.equal(transactionWrites[0].actorUserId, "admin_123456");
  assert.equal(transactionWrites[0].eventId, result.eventId);
  assert.equal(globalThis.__adminAuditWrites.length, 0);
});

test("audit persistence errors propagate so transactional callers can roll back", async () => {
  reset();
  const actor = await resolveAdminAuditActor();
  const transaction = {
    auditLog: {
      async create() {
        throw new Error("isolated persistence failure");
      },
    },
  };

  await assert.rejects(
    writeAdminAudit(actor, { action: "ADMIN_ACCOUNT_SUSPENDED" }, transaction),
    /isolated persistence failure/,
  );
  assert.equal(globalThis.__adminAuditWrites.length, 0);
});
