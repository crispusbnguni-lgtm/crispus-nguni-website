import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const data = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: data(""), shortCircuit: true };
  return nextResolve(specifier, context);
} });

const { isAccountAccessAllowed } = await import("../src/lib/account-access.ts");
const now = new Date("2026-11-12T10:00:00.000Z");
const account = (overrides = {}) => ({ accountStatus: "ACTIVE", accountSuspendedUntil: null, verificationStatus: "PENDING", ...overrides });

test("active pending-review accounts retain normal access while Super Admin verification remains separate", () => {
  assert.equal(isAccountAccessAllowed(account(), now), true);
});

test("unexpired and open-ended suspensions, bans, and rejected verification fail closed", () => {
  assert.equal(isAccountAccessAllowed(account({ accountStatus: "SUSPENDED", accountSuspendedUntil: null }), now), false);
  assert.equal(isAccountAccessAllowed(account({ accountStatus: "SUSPENDED", accountSuspendedUntil: new Date(now.getTime() + 1) }), now), false);
  assert.equal(isAccountAccessAllowed(account({ accountStatus: "BANNED" }), now), false);
  assert.equal(isAccountAccessAllowed(account({ verificationStatus: "REJECTED" }), now), false);
});

test("expired temporary suspensions restore access, but malformed timestamps fail closed", () => {
  assert.equal(isAccountAccessAllowed(account({ accountStatus: "SUSPENDED", accountSuspendedUntil: new Date(now.getTime() - 1) }), now), true);
  assert.equal(isAccountAccessAllowed(account({ accountStatus: "SUSPENDED", accountSuspendedUntil: new Date(Number.NaN) }), now), false);
  assert.equal(isAccountAccessAllowed(account({ accountStatus: "SUSPENDED", accountSuspendedUntil: "invalid" }), now), false);
});

test("unknown account or verification states and invalid clocks fail closed", () => {
  assert.equal(isAccountAccessAllowed(null, now), false);
  assert.equal(isAccountAccessAllowed(account({ accountStatus: "UNKNOWN" }), now), false);
  assert.equal(isAccountAccessAllowed(account(), new Date(Number.NaN)), false);
});
