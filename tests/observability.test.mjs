import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const data = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: data(""), shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { reportOperationalFailure } = await import("../src/lib/observability.ts");

test("operational failure logging emits only bounded structured fields", () => {
  const originalError = console.error;
  const records = [];
  console.error = (value) => records.push(JSON.parse(value));
  try {
    reportOperationalFailure("DISPLAY_STUDIO_DEFAULTS_READ_FAILED", {
      cause: new Error("private email@example.com bearer token secret-value"),
      correlationId: "not-a-request-id",
    });
  } finally {
    console.error = originalError;
  }

  assert.equal(records.length, 1);
  assert.deepEqual(Object.keys(records[0]).sort(), [
    "correlationId",
    "errorClass",
    "event",
    "level",
    "occurredAt",
  ]);
  assert.equal(records[0].event, "DISPLAY_STUDIO_DEFAULTS_READ_FAILED");
  assert.equal(records[0].errorClass, "Error");
  assert.match(records[0].correlationId, /^[0-9a-f-]{36}$/i);
  assert.equal(JSON.stringify(records).includes("example.com"), false);
  assert.equal(JSON.stringify(records).includes("private email"), false);
  assert.equal(JSON.stringify(records).includes("secret-value"), false);
});

test("diagnostic sink failures are non-throwing and unknown events are discarded", () => {
  const originalError = console.error;
  let calls = 0;
  console.error = () => {
    calls += 1;
    throw new Error("logging unavailable");
  };
  try {
    assert.doesNotThrow(() => reportOperationalFailure("DISPLAY_STUDIO_DEFAULTS_READ_FAILED"));
    assert.doesNotThrow(() => reportOperationalFailure("UNTRUSTED_EVENT"));
  } finally {
    console.error = originalError;
  }
  assert.equal(calls, 1);
});

test("Welcome Page read failures use the safe operational event catalogue", () => {
  const originalError = console.error;
  const records = [];
  console.error = (value) => records.push(JSON.parse(value));
  try {
    reportOperationalFailure("WELCOME_PAGE_CONTENT_READ_FAILED", {
      cause: new Error("postgres://private-user:private-password@db.example/private-db"),
    });
    reportOperationalFailure("WELCOME_BACKGROUND_READ_FAILED", {
      cause: new Error("private@example.com token-value"),
    });
  } finally {
    console.error = originalError;
  }

  assert.equal(records.length, 2);
  assert.deepEqual(records.map((record) => record.event), [
    "WELCOME_PAGE_CONTENT_READ_FAILED",
    "WELCOME_BACKGROUND_READ_FAILED",
  ]);
  const serialized = JSON.stringify(records);
  assert.doesNotMatch(serialized, /private-user|private-password|db\.example|private-db|private@example\.com|token-value/);
});
