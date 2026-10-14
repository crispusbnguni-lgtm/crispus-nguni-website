
"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  defaultReaderPreferences,
  useReader,
  type ReaderPreferences,
} from "@/components/ui/ReaderProvider";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";

type DisplayStudioMode = "global" | "personal";

type RangeKey =
  | "textScale"
  | "glassLevel"
  | "frostLevel"
  | "transparency"
  | "reflectionLevel"
  | "glassDepth";

type ChoiceKey =
  | "appearancePreset"
  | "colorMode"
  | "fontFamily"
  | "readingWidth"
  | "lineHeight"
  | "letterSpacing";

type ToggleKey =
  | "highContrast"
  | "reduceMotion"
  | "reduceTransparency"
  | "underlineLinks"
  | "focusMode";

const rangeControls: {
  key: RangeKey;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  percent?: boolean;
}[] = [
  {
    key: "glassLevel",
    label: "Glass intensity",
    description: "Controls the strength of the glass surface.",
    min: 0,
    max: 1,
    step: 0.01,
    percent: true,
  },
  {
    key: "frostLevel",
    label: "Frost and blur",
    description: "Controls the soft, frosted glass effect.",
    min: 0,
    max: 1,
    step: 0.01,
    percent: true,
  },
  {
    key: "transparency",
    label: "Transparency",
    description: "Controls how transparent glass surfaces appear.",
    min: 0,
    max: 1,
    step: 0.01,
    percent: true,
  },
  {
    key: "reflectionLevel",
    label: "Reflections",
    description: "Controls glass highlights and reflective edges.",
    min: 0,
    max: 1,
    step: 0.01,
    percent: true,
  },
  {
    key: "glassDepth",
    label: "Glass depth",
    description: "Controls depth and shadow intensity.",
    min: 0,
    max: 1,
    step: 0.01,
    percent: true,
  },
  {
    key: "textScale",
    label: "Text size",
    description: "Sets the reading text scale.",
    min: 0.8,
    max: 1.6,
    step: 0.05,
  },
];

const choiceControls: {
  key: ChoiceKey;
  label: string;
  options: { value: string; label: string }[];
}[] = [
  {
    key: "appearancePreset",
    label: "Appearance preset",
    options: [
      { value: "crispus", label: "Crispus" },
      { value: "crystal", label: "Crystal" },
      { value: "emerald", label: "Emerald" },
      { value: "light", label: "Light" },
    ],
  },
  {
    key: "colorMode",
    label: "Color mode",
    options: [
      { value: "dark", label: "Dark" },
      { value: "light", label: "Light" },
      { value: "sepia", label: "Sepia" },
    ],
  },
  {
    key: "fontFamily",
    label: "Font family",
    options: [
      { value: "one-ui", label: "Samsung One UI" },
      { value: "samsung-one", label: "Samsung One" },
      { value: "inter", label: "Inter" },
      { value: "geist", label: "Geist" },
      { value: "system", label: "System" },
      { value: "serif", label: "Serif" },
      { value: "mono", label: "Monospace" },
    ],
  },
  {
    key: "readingWidth",
    label: "Reading width",
    options: [
      { value: "normal", label: "Comfortable" },
      { value: "wide", label: "Wide" },
    ],
  },
  {
    key: "lineHeight",
    label: "Line height",
    options: [
      { value: "normal", label: "Normal" },
      { value: "relaxed", label: "Relaxed" },
      { value: "loose", label: "Loose" },
    ],
  },
  {
    key: "letterSpacing",
    label: "Letter spacing",
    options: [
      { value: "normal", label: "Normal" },
      { value: "wide", label: "Wide" },
      { value: "wider", label: "Extra wide" },
    ],
  },
];

const toggleControls: {
  key: ToggleKey;
  label: string;
  description: string;
}[] = [
  {
    key: "highContrast",
    label: "High contrast",
    description: "Improve contrast between text and surfaces.",
  },
  {
    key: "reduceMotion",
    label: "Reduce motion",
    description: "Reduce non-essential interface animations.",
  },
  {
    key: "reduceTransparency",
    label: "Reduce transparency",
    description: "Prefer more solid backgrounds for readability.",
  },
  {
    key: "underlineLinks",
    label: "Underline links",
    description: "Make links easier to identify.",
  },
  {
    key: "focusMode",
    label: "Focus mode",
    description: "Reduce visual distractions while reading.",
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isOneOf<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
): value is T {
  return (
    typeof value === "string" &&
    allowedValues.includes(value as T)
  );
}

/**
 * Validate settings received from the server before using them.
 * Missing or invalid values fall back to the built-in defaults.
 */
function sanitizePreferences(input: unknown): ReaderPreferences {
  const raw =
    input !== null && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  function readNumber(
    key: keyof ReaderPreferences,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const value = raw[key];

    if (typeof value !== "number" || !Number.isFinite(value)) {
      return fallback;
    }

    return clamp(value, min, max);
  }

  function readBoolean(
    key: ToggleKey,
    fallback: boolean,
  ): boolean {
    const value = raw[key];
    return typeof value === "boolean" ? value : fallback;
  }

  return {
    ...defaultReaderPreferences,

    textScale: readNumber(
      "textScale",
      defaultReaderPreferences.textScale,
      0.8,
      1.6,
    ),

    glassLevel: readNumber(
      "glassLevel",
      defaultReaderPreferences.glassLevel,
      0,
      1,
    ),

    frostLevel: readNumber(
      "frostLevel",
      defaultReaderPreferences.frostLevel,
      0,
      1,
    ),

    transparency: readNumber(
      "transparency",
      defaultReaderPreferences.transparency,
      0,
      1,
    ),

    reflectionLevel: readNumber(
      "reflectionLevel",
      defaultReaderPreferences.reflectionLevel,
      0,
      1,
    ),

    glassDepth: readNumber(
      "glassDepth",
      defaultReaderPreferences.glassDepth,
      0,
      1,
    ),

    appearancePreset: isOneOf(
      raw.appearancePreset,
      ["crispus", "crystal", "emerald", "light"] as const,
    )
      ? raw.appearancePreset
      : defaultReaderPreferences.appearancePreset,

    colorMode: isOneOf(
      raw.colorMode,
      ["dark", "light", "sepia"] as const,
    )
      ? raw.colorMode
      : defaultReaderPreferences.colorMode,

    fontFamily: isOneOf(
      raw.fontFamily,
      [
        "one-ui",
        "samsung-one",
        "inter",
        "geist",
        "system",
        "serif",
        "mono",
      ] as const,
    )
      ? raw.fontFamily
      : defaultReaderPreferences.fontFamily,

    readingWidth: isOneOf(
      raw.readingWidth,
      ["normal", "wide"] as const,
    )
      ? raw.readingWidth
      : defaultReaderPreferences.readingWidth,

    lineHeight: isOneOf(
      raw.lineHeight,
      ["normal", "relaxed", "loose"] as const,
    )
      ? raw.lineHeight
      : defaultReaderPreferences.lineHeight,

    letterSpacing: isOneOf(
      raw.letterSpacing,
      ["normal", "wide", "wider"] as const,
    )
      ? raw.letterSpacing
      : defaultReaderPreferences.letterSpacing,

    highContrast: readBoolean(
      "highContrast",
      defaultReaderPreferences.highContrast,
    ),

    reduceMotion: readBoolean(
      "reduceMotion",
      defaultReaderPreferences.reduceMotion,
    ),

    reduceTransparency: readBoolean(
      "reduceTransparency",
      defaultReaderPreferences.reduceTransparency,
    ),

    underlineLinks: readBoolean(
      "underlineLinks",
      defaultReaderPreferences.underlineLinks,
    ),

    focusMode: readBoolean(
      "focusMode",
      defaultReaderPreferences.focusMode,
    ),
  };
}

function formatValue(value: number, percent = false): string {
  return percent ? `${Math.round(value * 100)}%` : `${value.toFixed(2)}×`;
}

function RangeControl({
  label,
  description,
  value,
  min,
  max,
  step,
  percent,
  reduceMotion,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  percent?: boolean;
  reduceMotion: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 ${
        reduceMotion
          ? ""
          : "transition duration-300 hover:border-white/[0.16] hover:bg-white/[0.045]"
      }`}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium text-white/90">
            {label}
          </p>
          <p className="mt-1 break-words text-xs leading-5 text-white/45">
            {description}
          </p>
        </div>

        <output className="shrink-0 rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-medium tabular-nums text-white/75">
          {formatValue(value, percent)}
        </output>
      </div>

      <input
        aria-label={label}
        aria-valuetext={formatValue(value, percent)}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-5 block w-full cursor-pointer accent-[#126BFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#126BFF] focus-visible:ring-offset-4 focus-visible:ring-offset-[#080B12]"
      />

      <div className="mt-1 flex justify-between text-[10px] text-white/30">
        <span>{formatValue(min, percent)}</span>
        <span>{formatValue(max, percent)}</span>
      </div>
    </div>
  );
}

function ChoiceControl({
  label,
  value,
  options,
  reduceMotion,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  reduceMotion: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block break-words text-sm font-medium text-white/75">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`block min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-[#101521]/95 px-3 py-2 text-sm text-white outline-none focus:border-[#126BFF]/70 focus:ring-2 focus:ring-[#126BFF]/20 ${
          reduceMotion ? "" : "transition-colors duration-200"
        }`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleControl({
  label,
  description,
  checked,
  reduceMotion,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  reduceMotion: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div
      className={`flex min-w-0 items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 ${
        reduceMotion
          ? ""
          : "transition duration-300 hover:border-white/[0.16] hover:bg-white/[0.045]"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium text-white/85">
          {label}
        </p>
        <p className="mt-1 break-words text-xs leading-5 text-white/45">
          {description}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#126BFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080B12] ${
          reduceMotion ? "" : "transition-colors duration-200"
        } ${
          checked
            ? "border-[#126BFF] bg-[#126BFF]"
            : "border-white/15 bg-white/10"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm ${
            reduceMotion ? "" : "transition-transform duration-200"
          } ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}

export function DisplayStudioEditor({
  mode = "global",
}: {
  mode?: DisplayStudioMode;
}) {
  const reader = useReader();
  const systemPrefersReducedMotion = useReducedMotion();

  const [draftPreferences, setDraftPreferences] =
    useState<ReaderPreferences>({ ...defaultReaderPreferences });
  const [loading, setLoading] = useState(mode === "global");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(true);

  // Respect both the operating-system preference and the selected setting.
  const reduceMotion =
    Boolean(systemPrefersReducedMotion) ||
    (mode === "personal"
      ? reader.preferences.reduceMotion
      : draftPreferences.reduceMotion);

  // Personal settings apply immediately through ReaderProvider.
  // Global settings remain a separate draft until explicitly saved.
  const preferences =
    mode === "personal" ? reader.preferences : draftPreferences;

  const isLoading = mode === "global" && loading;

  useEffect(() => {
  if (mode !== "global") {
    return;
  }

  let active = true;

    async function loadSettings() {
      try {
        const response = await fetch("/api/display-studio", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Could not load saved display defaults.");
        }

        const data: unknown = await response.json();

        if (
          active &&
          data !== null &&
          typeof data === "object" &&
          "preferences" in data
        ) {
          const payload = data as { preferences?: unknown };

          if (payload.preferences !== undefined) {
            setDraftPreferences(sanitizePreferences(payload.preferences));
          }
        }
      } catch {
        if (active) {
          setError(
            "Unable to load saved defaults. Showing built-in defaults.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      active = false;
    };
  }, [mode]);

  function update<K extends keyof ReaderPreferences>(
    key: K,
    value: ReaderPreferences[K],
  ) {
    if (mode === "personal") {
      reader.updatePreference(key, value);
    } else {
      setDraftPreferences((current) => ({
        ...current,
        [key]: value,
      }));
    }

    setMessage("");
    setError("");
  }

  async function saveSettings() {
    if (mode === "personal") {
      setMessage("Your personal preferences are saved automatically.");
      setError("");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const safePreferences = sanitizePreferences(draftPreferences);

      const response = await fetch("/api/display-studio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: safePreferences }),
      });

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const serverMessage =
          data !== null &&
          typeof data === "object" &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Could not save display defaults.";

        throw new Error(serverMessage);
      }

      setDraftPreferences(safePreferences);
      setMessage("Global display defaults saved successfully.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Something went wrong while saving.",
      );
    } finally {
      setSaving(false);
    }
  }

  function resetEditor() {
    if (mode === "personal") {
      reader.resetPreferences();
      setMessage(
        "Personal overrides reset. Your workspace will use the current global defaults.",
      );
    } else {
      setDraftPreferences({ ...defaultReaderPreferences });
      setMessage("");
    }

    setError("");
  }

  const previewBackground =
    preferences.reduceTransparency
      ? preferences.colorMode === "light"
        ? "rgba(255,255,255,0.98)"
        : preferences.colorMode === "sepia"
          ? "rgba(65,49,29,0.98)"
          : "rgba(18,28,48,0.98)"
      : preferences.colorMode === "light"
        ? "rgba(255,255,255,0.78)"
        : preferences.colorMode === "sepia"
          ? "rgba(215,190,150,0.18)"
          : `rgba(18, 28, 48, ${0.18 + (1 - preferences.transparency) * 0.65})`;

  const previewTextColor =
    preferences.colorMode === "light"
      ? "#172033"
      : preferences.colorMode === "sepia"
        ? "#f1dfbd"
        : "#ffffff";

  const previewFontFamily =
    preferences.fontFamily === "serif"
      ? "Georgia, serif"
      : preferences.fontFamily === "mono"
        ? "monospace"
        : preferences.fontFamily === "inter"
          ? "Inter, Arial, sans-serif"
          : preferences.fontFamily === "geist"
            ? "'Geist', 'Inter', Arial, sans-serif"
            : preferences.fontFamily === "one-ui" ||
                preferences.fontFamily === "samsung-one"
              ? "'SamsungOne', 'Segoe UI', Roboto, Arial, sans-serif"
              : "system-ui, sans-serif";

  const previewLineHeight =
    preferences.lineHeight === "loose"
      ? 2
      : preferences.lineHeight === "relaxed"
        ? 1.8
        : 1.6;

  const previewLetterSpacing =
    preferences.letterSpacing === "wider"
      ? "0.08em"
      : preferences.letterSpacing === "wide"
        ? "0.04em"
        : "normal";

  return (
    <section className="mt-10 min-w-0 scroll-mt-24">
      <LiquidLensSurface
        radius={28}
        intensity="medium"
        className="min-w-0 overflow-hidden"
        style={{
          borderColor: "rgba(18,107,255,0.24)",
          padding: 0,
        }}
      >
        <div className="flex min-w-0 flex-col gap-5 border-b border-white/10 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#126BFF]/25 bg-[#126BFF]/10 text-xl text-blue-300"
              aria-hidden="true"
            >
              ◈
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
                {mode === "global"
                  ? "Global appearance"
                  : "Personal appearance"}
              </p>

              <h2 className="mt-2 break-words text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {mode === "global"
                  ? "Display Studio Defaults"
                  : "My Display Studio"}
              </h2>

              <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-white/45">
                {mode === "global"
                  ? "Set the starting appearance, glass effects, typography and accessibility options for visitors across your platform."
                  : "Personalize your glass effects, typography and accessibility settings. Your preferences are saved automatically in this browser and remain separate from global defaults."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            aria-controls="display-studio-editor-content"
            className="inline-flex min-h-11 max-w-full shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/75 hover:border-white/20 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#126BFF] lg:self-center"
          >
            <span>{expanded ? "Collapse editor" : "Open editor"}</span>
            <span
              className={
                reduceMotion
                  ? ""
                  : `transition-transform duration-300 ${
                      expanded ? "rotate-180" : ""
                    }`
              }
              aria-hidden="true"
            >
              ⌄
            </span>
          </button>
        </div>

        <div
          id="display-studio-editor-content"
          hidden={!expanded}
          className={
            reduceMotion
              ? ""
              : "animate-in fade-in duration-300"
          }
        >
          <div className="min-w-0 space-y-8 p-5 sm:p-7">
            {isLoading && (
              <p
                role="status"
                className={
                  reduceMotion
                    ? "text-sm text-white/45"
                    : "animate-pulse text-sm text-white/45"
                }
              >
                Loading saved display settings…
              </p>
            )}

            <div className="grid min-w-0 gap-7 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
              <div className="min-w-0 space-y-7">
                <div>
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-white">
                      Liquid Glass
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-white/40">
                      Tune the surfaces, frosted blur, reflections and depth
                      used throughout the interface.
                    </p>
                  </div>

                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    {rangeControls
                      .filter((control) => control.key !== "textScale")
                      .map((control) => (
                        <RangeControl
                          key={control.key}
                          label={control.label}
                          description={control.description}
                          min={control.min}
                          max={control.max}
                          step={control.step}
                          percent={control.percent}
                          value={preferences[control.key]}
                          reduceMotion={reduceMotion}
                          onChange={(value) => update(control.key, value)}
                        />
                      ))}
                  </div>
                </div>

                <div>
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-white">
                      Typography and appearance
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-white/40">
                      Choose the visual preset, colors and reading preferences
                      that work best for you.
                    </p>
                  </div>

                  <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                    {choiceControls.map((control) => (
                      <ChoiceControl
                        key={control.key}
                        label={control.label}
                        value={preferences[control.key]}
                        options={control.options}
                        reduceMotion={reduceMotion}
                        onChange={(value) =>
                          update(
                            control.key,
                            value as ReaderPreferences[typeof control.key],
                          )
                        }
                      />
                    ))}
                  </div>

                  <div className="mt-4">
                    {rangeControls
                      .filter((control) => control.key === "textScale")
                      .map((control) => (
                        <RangeControl
                          key={control.key}
                          label={control.label}
                          description={control.description}
                          min={control.min}
                          max={control.max}
                          step={control.step}
                          percent={control.percent}
                          value={preferences[control.key]}
                          reduceMotion={reduceMotion}
                          onChange={(value) => update(control.key, value)}
                        />
                      ))}
                  </div>
                </div>

                <div>
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-white">
                      Accessibility
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-white/40">
                      Adjust motion, contrast, transparency and reading
                      comfort.
                    </p>
                  </div>

                  <div className="grid min-w-0 gap-3 md:grid-cols-2">
                    {toggleControls.map((control) => (
                      <ToggleControl
                        key={control.key}
                        label={control.label}
                        description={control.description}
                        checked={preferences[control.key]}
                        reduceMotion={reduceMotion}
                        onChange={(checked) => update(control.key, checked)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <aside className="min-w-0">
                <div className="xl:sticky xl:top-6">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-white">
                      Live preview
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-white/40">
                      Preview the appearance while you adjust the controls.
                    </p>
                  </div>

                  <div
                    className={`relative isolate min-w-0 overflow-hidden rounded-3xl border p-4 sm:p-5 ${
                      reduceMotion ? "" : "transition-all duration-500"
                    }`}
                    style={{
                      borderColor: `rgba(255,255,255,${0.1 + preferences.reflectionLevel * 0.35})`,
                      background: previewBackground,
                      backdropFilter: preferences.reduceTransparency
                        ? "none"
                        : `blur(${2 + preferences.frostLevel * 28}px) saturate(${110 + preferences.glassLevel * 70}%)`,
                      WebkitBackdropFilter: preferences.reduceTransparency
                        ? "none"
                        : `blur(${2 + preferences.frostLevel * 28}px) saturate(${110 + preferences.glassLevel * 70}%)`,
                      boxShadow: `0 ${8 + preferences.glassDepth * 20}px ${24 + preferences.glassDepth * 30}px rgba(0,0,0,${0.12 + preferences.glassDepth * 0.18})`,
                      color: previewTextColor,
                      fontFamily: previewFontFamily,
                      fontSize: `${preferences.textScale}rem`,
                      lineHeight: previewLineHeight,
                      letterSpacing: previewLetterSpacing,
                      fontWeight: preferences.highContrast ? 600 : 400,
                    }}
                  >
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 h-px"
                      style={{
                        background: `rgba(255,255,255,${0.1 + preferences.reflectionLevel * 0.65})`,
                      }}
                    />

                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <span className="min-w-0 break-words text-xs font-semibold uppercase tracking-[0.16em] opacity-65">
                        Crispus Studio
                      </span>
                      <span className="shrink-0 rounded-full border border-current/15 px-2 py-1 text-[10px] opacity-70">
                        Preview
                      </span>
                    </div>

                    <div className="mt-7">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] opacity-60">
                        Your next chapter
                      </p>
                      <h4 className="mt-3 break-words text-2xl font-semibold tracking-tight">
                        Design that feels natural.
                      </h4>
                      <p className="mt-3 break-words text-sm opacity-70">
                        A calmer, clearer digital experience with carefully
                        balanced glass, light and depth.
                      </p>
                    </div>

                    <div
                      className={`mt-6 rounded-2xl border p-4 ${
                        reduceMotion ? "" : "transition-all duration-500"
                      }`}
                      style={{
                        borderColor: `rgba(255,255,255,${0.08 + preferences.reflectionLevel * 0.28})`,
                        background: preferences.reduceTransparency
                          ? "rgba(20,28,42,0.96)"
                          : `rgba(255,255,255,${Math.max(0.025, (1 - preferences.transparency) * 0.2)})`,
                        boxShadow: `0 8px 24px rgba(0,0,0,${preferences.glassDepth * 0.16})`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 shrink-0 rounded-xl bg-[#126BFF]/20 ring-1 ring-[#126BFF]/30"
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-medium">
                            Liquid Glass Surface
                          </p>
                          <p className="mt-1 break-words text-xs opacity-60">
                            Depth · Reflection · Clarity
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="mt-5 min-h-11 max-w-full rounded-xl bg-[#126BFF] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2477ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                    >
                      Explore the experience
                    </button>

                    {preferences.highContrast && (
                      <p className="mt-4 rounded-lg border border-current/30 px-3 py-2 text-xs font-semibold">
                        High contrast enabled
                      </p>
                    )}

                    {preferences.reduceTransparency && (
                      <p className="mt-2 text-xs opacity-70">
                        Reduced transparency is enabled.
                      </p>
                    )}

                    {preferences.reduceMotion && (
                      <p className="mt-2 text-xs opacity-70">
                        Reduced motion is enabled.
                      </p>
                    )}

                    {preferences.underlineLinks && (
                      <p className="mt-2 text-xs underline">
                        Link underlining enabled
                      </p>
                    )}

                    {preferences.focusMode && (
                      <p className="mt-2 text-xs opacity-70">
                        Focus mode enabled
                      </p>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3">
                      <p className="break-words text-xs text-white/40">
                        Appearance
                      </p>
                      <p className="mt-1 break-words text-sm font-medium capitalize text-white/85">
                        {preferences.appearancePreset}
                      </p>
                    </div>

                    <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3">
                      <p className="break-words text-xs text-white/40">
                        Glass intensity
                      </p>
                      <p className="mt-1 text-sm font-medium text-white/85">
                        {Math.round(preferences.glassLevel * 100)}%
                      </p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            <div className="border-t border-white/10 pt-6">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  {message && (
                    <p
                      role="status"
                      aria-live="polite"
                      className="break-words text-sm text-emerald-300"
                    >
                      {message}
                    </p>
                  )}

                  {error && (
                    <p
                      role="alert"
                      aria-live="assertive"
                      className="break-words text-sm text-rose-300"
                    >
                      {error}
                    </p>
                  )}

                  {!message && !error && (
                    <p className="text-sm leading-6 text-white/40">
                      {mode === "global"
                        ? "Changes are previews until you save them. Personal preferences remain separate."
                        : "Your personal changes apply immediately and are saved automatically. Reset to inherit the current global defaults."}
                    </p>
                  )}
                </div>

                <div className="flex min-w-0 flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={resetEditor}
                    disabled={saving || isLoading}
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/70 hover:border-white/20 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#126BFF] disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                  >
                    {mode === "global"
                      ? "Reset editor"
                      : "Reset personal settings"}
                  </button>

                  {mode === "global" && (
                    <button
                      type="button"
                      onClick={saveSettings}
                      disabled={saving || isLoading}
                      className={`min-h-11 min-w-0 flex-1 rounded-xl border border-[#126BFF]/40 bg-[#126BFF] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(18,107,255,0.18)] hover:bg-[#2477ff] hover:shadow-[0_12px_30px_rgba(18,107,255,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none ${
                        reduceMotion ? "" : "transition duration-300 hover:-translate-y-0.5"
                      }`}
                    >
                      {saving ? "Saving…" : "Save global defaults"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </LiquidLensSurface>
    </section>
  );
}