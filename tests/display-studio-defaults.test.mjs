import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

globalThis.__displayDefaultsState = { value: null, error: false, calls: 0, events: [] };

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") {
      return {
        url: dataModule(`export class NextResponse { static json(body, init = {}) { return { body, status: init.status ?? 200, headers: new Headers(init.headers) }; } }`),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/observability") {
      return {
        url: dataModule(`export function reportOperationalFailure(event, options) { const state = globalThis.__displayDefaultsState; state.events ??= []; state.events.push({ event, errorClass: options?.cause instanceof Error ? options.cause.name : "UnknownError" }); }`),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/prisma") {
      return {
        url: dataModule(`
          export const prisma = {
            displayStudioSettings: {
              async findUnique(args) {
                globalThis.__displayDefaultsState.calls += 1;
                globalThis.__displayDefaultsState.args = args;
                if (globalThis.__displayDefaultsState.error) throw new Error("database unavailable");
                return globalThis.__displayDefaultsState.value === null ? null : { preferences: globalThis.__displayDefaultsState.value };
              }
            }
          };
        `),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/display-studio-preferences") {
      return { url: new URL("../src/lib/display-studio-preferences.ts", import.meta.url).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { GET } = await import("../src/app/api/display-studio/defaults/route.ts");
const {
  DEFAULT_DISPLAY_STUDIO_PREFERENCES,
  resolveDisplayStudioPreferences,
  sanitizeDisplayStudioPreferences,
  setDisplayStudioPreferenceOverride,
} = await import(
  "../src/lib/display-studio-preferences.ts"
);

test("public defaults endpoint returns global display settings without account data", async () => {
  globalThis.__displayDefaultsState = {
    value: { colorMode: "sepia", glassLevel: 0.4, unrelated: "private" },
    error: false,
    calls: 0,
  };

  const response = await GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.body.preferences.colorMode, "sepia");
  assert.equal(response.body.preferences.glassLevel, 0.4);
  assert.equal("unrelated" in response.body.preferences, false);
  assert.deepEqual(globalThis.__displayDefaultsState.args, {
    where: { id: "main" },
    select: { preferences: true },
  });
});

test("missing settings use built-in defaults while database failures remain visible", async () => {
  globalThis.__displayDefaultsState = { value: null, error: false, calls: 0 };
  const missing = await GET();
  assert.deepEqual(missing.body.preferences, DEFAULT_DISPLAY_STUDIO_PREFERENCES);

  globalThis.__displayDefaultsState = { value: null, error: true, calls: 0 };
  const unavailable = await GET();
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get("cache-control"), "no-store");
  assert.deepEqual(unavailable.body, { error: "Display settings are temporarily unavailable." });
  assert.equal(JSON.stringify(unavailable.body).includes("database unavailable"), false);
  assert.deepEqual(globalThis.__displayDefaultsState.events, [
    { event: "DISPLAY_STUDIO_DEFAULTS_READ_FAILED", errorClass: "Error" },
  ]);
});

test("shared sanitizer bounds values and excludes unknown or malformed options", () => {
  const sanitized = sanitizeDisplayStudioPreferences({
    glassLevel: 8,
    textScale: Number.NaN,
    colorMode: "automatic",
    reduceMotion: true,
    privateToken: "must not pass through",
  });

  assert.equal(sanitized.glassLevel, 1);
  assert.equal(sanitized.textScale, DEFAULT_DISPLAY_STUDIO_PREFERENCES.textScale);
  assert.equal(sanitized.colorMode, "dark");
  assert.equal(sanitized.reduceMotion, true);
  assert.equal("privateToken" in sanitized, false);
});

test("users without an override inherit changed global defaults", () => {
  const globalDefaults = {
    ...DEFAULT_DISPLAY_STUDIO_PREFERENCES,
    colorMode: "sepia",
    glassLevel: 0.4,
  };

  assert.deepEqual(
    resolveDisplayStudioPreferences(globalDefaults, {}),
    globalDefaults,
  );
});

test("explicit personal overrides survive global default changes", () => {
  const firstDefaults = {
    ...DEFAULT_DISPLAY_STUDIO_PREFERENCES,
    colorMode: "sepia",
    glassLevel: 0.4,
  };
  const overrides = { colorMode: "light" };
  const nextDefaults = { ...firstDefaults, colorMode: "dark", glassLevel: 0.8 };
  const resolved = resolveDisplayStudioPreferences(nextDefaults, overrides);

  assert.equal(resolved.colorMode, "light");
  assert.equal(resolved.glassLevel, 0.8);
  assert.equal(firstDefaults.colorMode, "sepia");
  assert.deepEqual(overrides, { colorMode: "light" });
});

test("removing a personal override restores inheritance from current defaults", () => {
  const globalDefaults = {
    ...DEFAULT_DISPLAY_STUDIO_PREFERENCES,
    colorMode: "sepia",
  };
  const overrides = setDisplayStudioPreferenceOverride(
    globalDefaults,
    { colorMode: "light" },
    "colorMode",
    "sepia",
  );

  assert.deepEqual(overrides, {});
  assert.equal(resolveDisplayStudioPreferences(globalDefaults, overrides).colorMode, "sepia");
});
