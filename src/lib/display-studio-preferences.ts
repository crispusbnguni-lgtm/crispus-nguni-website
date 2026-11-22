export type DisplayStudioPreferences = {
  textScale: number;
  readingWidth: "normal" | "wide";
  fontFamily:
    | "one-ui"
    | "samsung-one"
    | "inter"
    | "geist"
    | "system"
    | "serif"
    | "mono";
  glassLevel: number;
  frostLevel: number;
  transparency: number;
  reflectionLevel: number;
  glassDepth: number;
  appearancePreset: "crispus" | "crystal" | "emerald" | "light";
  lineHeight: "normal" | "relaxed" | "loose";
  letterSpacing: "normal" | "wide" | "wider";
  colorMode: "dark" | "light" | "sepia";
  highContrast: boolean;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  underlineLinks: boolean;
  focusMode: boolean;
};

export const DEFAULT_DISPLAY_STUDIO_PREFERENCES: DisplayStudioPreferences = {
  textScale: 1,
  readingWidth: "normal",
  fontFamily: "one-ui",
  glassLevel: 0.72,
  frostLevel: 0,
  transparency: 0.72,
  reflectionLevel: 0.65,
  glassDepth: 0.65,
  appearancePreset: "crispus",
  lineHeight: "normal",
  letterSpacing: "normal",
  colorMode: "dark",
  highContrast: false,
  reduceMotion: false,
  reduceTransparency: false,
  underlineLinks: false,
  focusMode: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function oneOf<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  return typeof value === "string" && choices.includes(value as T) ? value as T : fallback;
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Returns only supported, bounded appearance settings; unknown stored keys are ignored. */
export function sanitizeDisplayStudioPreferences(value: unknown): DisplayStudioPreferences {
  const input = isRecord(value) ? value : {};
  const defaults = DEFAULT_DISPLAY_STUDIO_PREFERENCES;

  return {
    textScale: boundedNumber(input.textScale, defaults.textScale, 0.8, 1.6),
    readingWidth: oneOf(input.readingWidth, ["normal", "wide"], defaults.readingWidth),
    fontFamily: oneOf(input.fontFamily, ["one-ui", "samsung-one", "inter", "geist", "system", "serif", "mono"], defaults.fontFamily),
    glassLevel: boundedNumber(input.glassLevel, defaults.glassLevel, 0, 1),
    frostLevel: boundedNumber(input.frostLevel, defaults.frostLevel, 0, 1),
    transparency: boundedNumber(input.transparency, defaults.transparency, 0, 1),
    reflectionLevel: boundedNumber(input.reflectionLevel, defaults.reflectionLevel, 0, 1),
    glassDepth: boundedNumber(input.glassDepth, defaults.glassDepth, 0, 1),
    appearancePreset: oneOf(input.appearancePreset, ["crispus", "crystal", "emerald", "light"], defaults.appearancePreset),
    lineHeight: oneOf(input.lineHeight, ["normal", "relaxed", "loose"], defaults.lineHeight),
    letterSpacing: oneOf(input.letterSpacing, ["normal", "wide", "wider"], defaults.letterSpacing),
    colorMode: oneOf(input.colorMode, ["dark", "light", "sepia"], defaults.colorMode),
    highContrast: booleanValue(input.highContrast, defaults.highContrast),
    reduceMotion: booleanValue(input.reduceMotion, defaults.reduceMotion),
    reduceTransparency: booleanValue(input.reduceTransparency, defaults.reduceTransparency),
    underlineLinks: booleanValue(input.underlineLinks, defaults.underlineLinks),
    focusMode: booleanValue(input.focusMode, defaults.focusMode),
  };
}

export type DisplayStudioPreferenceOverrides = Partial<DisplayStudioPreferences>;

/** Validates only explicitly stored overrides so missing keys continue to inherit. */
export function sanitizeDisplayStudioOverrides(value: unknown): DisplayStudioPreferenceOverrides {
  if (!isRecord(value)) return {};

  const sanitized = sanitizeDisplayStudioPreferences({
    ...DEFAULT_DISPLAY_STUDIO_PREFERENCES,
    ...value,
  });
  const overrides: DisplayStudioPreferenceOverrides = {};

  for (const key of Object.keys(DEFAULT_DISPLAY_STUDIO_PREFERENCES) as Array<keyof DisplayStudioPreferences>) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      Object.assign(overrides, { [key]: sanitized[key] });
    }
  }

  return overrides;
}

/** Resolves each visit from current global defaults plus explicit personal overrides. */
export function resolveDisplayStudioPreferences(
  globalDefaults: unknown,
  overrides: unknown,
): DisplayStudioPreferences {
  return {
    ...sanitizeDisplayStudioPreferences(globalDefaults),
    ...sanitizeDisplayStudioOverrides(overrides),
  };
}

/** Updates one personal override without mutating the global defaults. */
export function setDisplayStudioPreferenceOverride<K extends keyof DisplayStudioPreferences>(
  globalDefaults: DisplayStudioPreferences,
  currentOverrides: unknown,
  key: K,
  value: DisplayStudioPreferences[K],
): DisplayStudioPreferenceOverrides {
  const overrides = sanitizeDisplayStudioOverrides(currentOverrides);

  if (Object.is(value, globalDefaults[key])) {
    delete overrides[key];
  } else {
    Object.assign(overrides, { [key]: value });
  }

  return overrides;
}
