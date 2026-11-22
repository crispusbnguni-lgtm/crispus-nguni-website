import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: dataModule(""), shortCircuit: true };
    }
    if (specifier === "@upstash/redis") {
      return {
        url: dataModule(`
          export class Redis {
            constructor() {}
            async xadd() {
              throw new Error("Production Redis must never be contacted in tests.");
            }
          }
        `),
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const {
  ADMIN_AUDIT_WRITE_FAILURE,
  classifyAdminAuditWriteError,
  createAdminAuditFallbackService,
  SUPER_ADMIN_VERIFICATION_AUDIT_ACTION,
} = await import("../src/lib/admin-audit-fallback.ts");

const fixedEventId = "1be2b48b-c431-47d2-9637-43fc2ce5d3dd";
const fixedTime = new Date("2026-11-11T08:30:45.123Z");

function makeInput(overrides = {}) {
  return {
    actor: {
      userId: "user_1234567890",
      role: "SUPER_ADMIN",
      authenticationMethod: "EMAIL",
    },
    primaryError: Object.assign(new Error("private SQL/credential detail"), {
      code: "P1001",
    }),
    ...overrides,
  };
}

function makeService(overrides = {}) {
  const diagnostics = [];
  const alerts = [];
  const service = createAdminAuditFallbackService({
    sink: null,
    now: () => new Date(fixedTime),
    createEventId: () => fixedEventId,
    diagnostic: async (entry) => diagnostics.push(entry),
    alert: async (entry) => {
      alerts.push(entry);
      return true;
    },
    ...overrides,
  });
  return { service, diagnostics, alerts };
}

test("creates a typed event with server-generated ID and UTC timestamp", async () => {
  let storedEvent;
  const { service } = makeService({
    sink: {
      async append(event) {
        storedEvent = event;
        return "1794385845123-0";
      },
    },
  });

  const result = await service.record(makeInput());

  assert.equal(result.status, "fallback_accepted");
  assert.equal(result.eventId, fixedEventId);
  assert.equal(result.correlationId, fixedEventId);
  assert.equal(result.receiptId, "1794385845123-0");
  assert.equal(result.alertOutcome, "not_attempted");
  assert.equal(result.diagnosticOutcome, "not_attempted");
  assert.deepEqual(storedEvent, {
    eventType: ADMIN_AUDIT_WRITE_FAILURE,
    eventId: fixedEventId,
    correlationId: fixedEventId,
    occurredAt: "2026-11-11T08:30:45.123Z",
    userId: "user_1234567890",
    role: "SUPER_ADMIN",
    originalAction: SUPER_ADMIN_VERIFICATION_AUDIT_ACTION,
    authenticationMethod: "EMAIL",
    errorClassification: "DATABASE_UNAVAILABLE",
  });
});

test("uses a validated shared event ID instead of generating a new one", async () => {
  let storedEvent;
  const { service } = makeService({
    sink: {
      async append(event) {
        storedEvent = event;
        return "1794385845123-0";
      },
    },
    createEventId() {
      throw new Error("A supplied event ID should be used.");
    },
  });

  const result = await service.record(makeInput({ eventId: fixedEventId }));

  assert.equal(result.status, "fallback_accepted");
  assert.equal(result.eventId, fixedEventId);
  assert.equal(storedEvent.eventId, fixedEventId);
  assert.equal(storedEvent.correlationId, fixedEventId);
});

test("rejects invalid shared event IDs without calling the sink", async () => {
  let appendCount = 0;
  const { service } = makeService({
    sink: { async append() { appendCount += 1; return "1-0"; } },
  });

  for (const eventId of ["not-a-uuid", "person@example.test", "1-0", ""]) {
    const result = await service.record(makeInput({ eventId }));
    assert.equal(result.status, "unconfirmed");
    assert.equal(result.eventId, null);
  }

  assert.equal(appendCount, 0);
});

test("rejects extra or PII-bearing actor and event fields without calling the sink", async () => {
  let appendCount = 0;
  const { service, diagnostics } = makeService({
    sink: { async append() { appendCount += 1; return "1-0"; } },
  });

  const actorWithEmail = makeInput({
    actor: {
      userId: "user_1234567890",
      role: "SUPER_ADMIN",
      authenticationMethod: "EMAIL",
      email: "person@example.test",
    },
  });
  const inputWithSecret = { ...makeInput(), token: "never-store-this-token" };
  const emailAsUserId = makeInput({
    actor: { userId: "person@example.test", role: "SUPER_ADMIN", authenticationMethod: "EMAIL" },
  });
  const phoneAsUserId = makeInput({
    actor: { userId: "+15551234567", role: "SUPER_ADMIN", authenticationMethod: "EMAIL" },
  });

  for (const input of [actorWithEmail, inputWithSecret, emailAsUserId, phoneAsUserId]) {
    const result = await service.record(input);
    assert.equal(result.status, "unconfirmed");
  }

  assert.equal(appendCount, 0);
  assert.equal(JSON.stringify(diagnostics).includes("person@example.test"), false);
  assert.equal(JSON.stringify(diagnostics).includes("never-store-this-token"), false);
});

test("accepts only allowlisted error classifications and never returns raw errors", () => {
  const error = Object.assign(
    new Error("password=must-not-appear; SELECT secret from users"),
    { code: "P2024" },
  );

  assert.equal(classifyAdminAuditWriteError(error), "TIMEOUT");
  assert.equal(classifyAdminAuditWriteError({ code: "P2002", message: "private" }), "CONSTRAINT_FAILURE");
  assert.equal(classifyAdminAuditWriteError({ code: "untrusted@example.test" }), "UNKNOWN");
  assert.equal(classifyAdminAuditWriteError("raw database failure"), "UNKNOWN");
});

test("missing separately configured sink returns unconfirmed and reports degradation", async () => {
  const { service, diagnostics, alerts } = makeService({ sink: null });

  const result = await service.record(makeInput());

  assert.equal(result.status, "unconfirmed");
  assert.equal(result.eventId, fixedEventId);
  assert.equal(result.errorClassification, "DATABASE_UNAVAILABLE");
  assert.equal(result.alertOutcome, "accepted");
  assert.equal(result.diagnosticOutcome, "emitted");
  assert.equal(diagnostics[0].reason, "SINK_UNAVAILABLE");
  assert.equal(diagnostics[0].fallbackOutcome, "unconfirmed");
  assert.equal(alerts.length, 1);
});

test("Redis sink failure returns unconfirmed without leaking the thrown error", async () => {
  const { service, diagnostics } = makeService({
    sink: {
      async append() {
        throw new Error("postgres://admin:password@example/db?token=secret");
      },
    },
  });

  const result = await service.record(makeInput());

  assert.equal(result.status, "unconfirmed");
  assert.equal(result.alertOutcome, "accepted");
  assert.equal(result.diagnosticOutcome, "emitted");
  assert.equal(diagnostics[0].reason, "SINK_FAILURE");
  assert.equal(JSON.stringify(diagnostics).includes("postgres://"), false);
  assert.equal(JSON.stringify(diagnostics).includes("password"), false);
  assert.equal(JSON.stringify(diagnostics).includes("secret"), false);
});

test("malformed sink acknowledgement is not reported as accepted", async () => {
  const { service, diagnostics } = makeService({
    sink: { async append() { return { accepted: true, receiptId: "" }; } },
  });

  const result = await service.record(makeInput());

  assert.equal(result.status, "unconfirmed");
  assert.equal(result.alertOutcome, "accepted");
  assert.equal(diagnostics[0].reason, "INVALID_ACKNOWLEDGEMENT");
});

test("alert and diagnostic failures never throw or imply durable recording", async () => {
  const { service } = makeService({
    sink: { async append() { throw new Error("sink unavailable"); } },
    alert: async () => { throw new Error("alert unavailable"); },
    diagnostic: async () => { throw new Error("logger unavailable"); },
  });

  const recording = service.record(makeInput());
  await assert.doesNotReject(recording);
  const result = await recording;

  assert.equal(result.status, "unconfirmed");
  assert.equal(result.alertOutcome, "failed");
  assert.equal(result.diagnosticOutcome, "failed");
  assert.equal("durable" in result, false);
});

test("sink timeout returns unconfirmed and late completion cannot change it", async () => {
  let resolveSink;
  const sinkPromise = new Promise((resolve) => { resolveSink = resolve; });
  const { service } = makeService({
    sink: { append: () => sinkPromise },
    timeouts: { sinkMs: 5, alertMs: 5, diagnosticMs: 5 },
  });

  const result = await service.record(makeInput());
  assert.equal(result.status, "unconfirmed");
  assert.equal(result.alertOutcome, "accepted");
  assert.equal(result.diagnosticOutcome, "emitted");

  resolveSink("1794385845123-0");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(result.status, "unconfirmed");
});

test("late sink rejection after timeout is observed without an unhandled rejection", async () => {
  let rejectSink;
  const sinkPromise = new Promise((_resolve, reject) => { rejectSink = reject; });
  const { service } = makeService({
    sink: { append: () => sinkPromise },
    timeouts: { sinkMs: 5, alertMs: 5, diagnosticMs: 5 },
  });

  const result = await service.record(makeInput());
  assert.equal(result.status, "unconfirmed");

  rejectSink(new Error("late private sink error"));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(result.status, "unconfirmed");
});

test("alert and diagnostic timeouts are reported as failed despite late completion", async () => {
  let resolveAlert;
  let resolveDiagnostic;
  const alertPromise = new Promise((resolve) => { resolveAlert = resolve; });
  const diagnosticPromise = new Promise((resolve) => { resolveDiagnostic = resolve; });
  const { service } = makeService({
    sink: { async append() { throw new Error("sink failure"); } },
    alert: () => alertPromise,
    diagnostic: () => diagnosticPromise,
    timeouts: { sinkMs: 10, alertMs: 5, diagnosticMs: 5 },
  });

  const result = await service.record(makeInput());
  assert.equal(result.status, "unconfirmed");
  assert.equal(result.alertOutcome, "failed");
  assert.equal(result.diagnosticOutcome, "failed");

  resolveAlert(true);
  resolveDiagnostic(undefined);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(result.alertOutcome, "failed");
  assert.equal(result.diagnosticOutcome, "failed");
});

test("late alert and diagnostic rejections are observed after timeout", async () => {
  let rejectAlert;
  let rejectDiagnostic;
  const alertPromise = new Promise((_resolve, reject) => { rejectAlert = reject; });
  const diagnosticPromise = new Promise((_resolve, reject) => { rejectDiagnostic = reject; });
  const { service } = makeService({
    sink: { async append() { throw new Error("sink failure"); } },
    alert: () => alertPromise,
    diagnostic: () => diagnosticPromise,
    timeouts: { sinkMs: 10, alertMs: 5, diagnosticMs: 5 },
  });

  const result = await service.record(makeInput());
  assert.equal(result.status, "unconfirmed");
  assert.equal(result.alertOutcome, "failed");
  assert.equal(result.diagnosticOutcome, "failed");

  rejectAlert(new Error("late alert error"));
  rejectDiagnostic(new Error("late diagnostic error"));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(result.alertOutcome, "failed");
  assert.equal(result.diagnosticOutcome, "failed");
});

test("invalid server clock and invalid actor role fail closed", async () => {
  const { service: invalidClockService } = makeService({
    sink: { async append() { return "1-0"; } },
    now: () => new Date(Number.NaN),
  });
  const { service: invalidRoleService } = makeService({
    sink: { async append() { return "1-0"; } },
  });

  assert.equal((await invalidClockService.record(makeInput())).status, "unconfirmed");
  assert.equal((await invalidRoleService.record(makeInput({
    actor: { userId: "user_1234567890", role: "USER", authenticationMethod: "EMAIL" },
  }))).status, "unconfirmed");
});
