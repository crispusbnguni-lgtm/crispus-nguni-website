import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/consultations/timezone-core") {
      return {
        url: new URL("../src/lib/consultations/timezone-core.ts", import.meta.url).href,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const { DEFAULT_WORKSPACE_PREFERENCES, parseWorkspacePreferences } =
  await import("../src/lib/personal-workspace-core.ts");

test("workspace defaults are a valid private account configuration", () => {
  const result = parseWorkspacePreferences(DEFAULT_WORKSPACE_PREFERENCES);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.preferences.mode, "CUSTOM");
    assert.equal(result.preferences.timezone, "Africa/Nairobi");
    assert.deepEqual(result.preferences.focusAreas, []);
  }
});

test("valid workspace preferences accept configurable mode, focus and timezone", () => {
  const result = parseWorkspacePreferences({
    mode: "STUDENT",
    focusAreas: ["STUDY_AND_TIMETABLE", "TASKS_AND_PLANS"],
    timezone: "Europe/London",
    workingHoursStart: "08:30",
    workingHoursEnd: "19:00",
    breakMinutes: 20,
    weekStartsOn: 0,
  });
  assert.equal(result.success, true);
});

test("unsupported, duplicate and cross-account preference fields are rejected", () => {
  const duplicate = parseWorkspacePreferences({
    ...DEFAULT_WORKSPACE_PREFERENCES,
    focusAreas: ["PROJECTS", "PROJECTS"],
  });
  const crossAccount = parseWorkspacePreferences({
    ...DEFAULT_WORKSPACE_PREFERENCES,
    userId: "another-user",
  });
  const unsupported = parseWorkspacePreferences({
    ...DEFAULT_WORKSPACE_PREFERENCES,
    mode: "ADMIN",
  });
  assert.equal(duplicate.success, false);
  assert.equal(crossAccount.success, false);
  assert.equal(unsupported.success, false);
});

test("invalid timezone, clock values and numeric settings fail validation", () => {
  for (const changes of [
    { timezone: "Not/A_Timezone" },
    { workingHoursStart: "25:90" },
    { breakMinutes: 181 },
    { weekStartsOn: 7 },
  ]) {
    assert.equal(
      parseWorkspacePreferences({ ...DEFAULT_WORKSPACE_PREFERENCES, ...changes }).success,
      false,
    );
  }
});
