import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const data = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: data(""), shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const { reportAuthOperationFailure } = await import("../src/lib/auth-diagnostics.ts");

test("diagnostics identify only an allowlisted missing schema column and omit raw details", () => {
  const lines = [];
  const original = console.error;
  console.error = (line) => lines.push(String(line));
  try {
    const error = new Error("postgres://private:password@example.test failed; user@example.test");
    error.name = "PrismaClientKnownRequestError";
    error.code = "P2022";
    error.meta = { column: "User.accountStatus" };
    reportAuthOperationFailure("LOGIN_MFA_COMPLETION", error);
  } finally {
    console.error = original;
  }

  assert.equal(lines.length, 1);
  const diagnostic = JSON.parse(lines[0]);
  assert.equal(diagnostic.event, "AUTHENTICATION_OPERATION_FAILED");
  assert.equal(diagnostic.operation, "LOGIN_MFA_COMPLETION");
  assert.equal(diagnostic.prismaCode, "P2022");
  assert.equal(diagnostic.missingSchemaColumn, "accountStatus");
  assert.equal("message" in diagnostic, false);
  assert.equal("stack" in diagnostic, false);
  assert.doesNotMatch(lines[0], /password|private|example\.test|postgres:\/\//i);
});

test("unknown columns, unapproved error codes and operation names are not emitted", () => {
  const lines = [];
  const original = console.error;
  console.error = (line) => lines.push(String(line));
  try {
    const error = new Error("sensitive database details");
    error.code = "P9999";
    error.meta = { column: "User.secretToken" };
    reportAuthOperationFailure("LOGIN_ACCOUNT_LOOKUP", error);
    reportAuthOperationFailure("UNTRUSTED_OPERATION", error);
  } finally {
    console.error = original;
  }

  assert.equal(lines.length, 1);
  const diagnostic = JSON.parse(lines[0]);
  assert.equal(diagnostic.prismaCode, undefined);
  assert.equal(diagnostic.missingSchemaColumn, undefined);
  assert.doesNotMatch(lines[0], /sensitive|secretToken|P9999/);
});
