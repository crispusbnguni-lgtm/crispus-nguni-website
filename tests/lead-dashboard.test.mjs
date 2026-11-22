import assert from "node:assert/strict";
import test from "node:test";
import {
  LEADS_PER_PAGE,
  parseLeadPage,
  resolveLeadPage,
  singleQueryValue,
} from "../src/lib/lead-dashboard.ts";

test("duplicate or non-string query parameters are rejected as scalar values", () => {
  assert.equal(singleQueryValue(undefined), "");
  assert.equal(singleQueryValue(["2", "3"]), "");
  assert.equal(singleQueryValue("valid"), "valid");
});

test("lead page parsing accepts bounded positive integers only", () => {
  assert.equal(parseLeadPage("4"), 4);
  assert.equal(parseLeadPage("4garbage"), 1);
  assert.equal(parseLeadPage("0"), 1);
  assert.equal(parseLeadPage("-5"), 1);
  assert.equal(parseLeadPage("9".repeat(40)), 1);
  assert.equal(parseLeadPage(["4"]), 1);
});

test("lead pagination clamps before calculating the database offset", () => {
  assert.deepEqual(resolveLeadPage(99, 21), {
    page: 3,
    totalPages: 3,
    skip: 20,
  });
  assert.deepEqual(resolveLeadPage(5, 0), {
    page: 1,
    totalPages: 1,
    skip: 0,
  });
  assert.equal(LEADS_PER_PAGE, 10);
});
