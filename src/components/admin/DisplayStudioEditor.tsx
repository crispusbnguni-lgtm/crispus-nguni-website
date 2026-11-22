
"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  defaultReaderPreferences,
  useReader,
  type ReaderPreferences,
} from "@/components/ui/ReaderProvider";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";
import { LensGlass } from "@/components/ui/LensGlass";

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
  const progress =
    max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div
      className={`group relative min-w-0 overflow-hidden rounded-[22px] border border-white/[0.09] bg-white/[0.035] p-4 backdrop-blur-xl ${
        reduceMotion
          ? ""
          : "transition-all duration-300 hover:border-white/[0.17] hover:bg-white/[0.055] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
      }`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight text-white/90">
            {label}
          </p>
          <p className="mt-1 text-xs leading-5 text-white/45">
            {description}
          </p>
        </div>

        <output className="shrink-0 rounded-full border border-blue-300/20 bg-blue-400/[0.10] px-3 py-1.5 text-xs font-semibold tabular-nums text-blue-200">
          {formatValue(value, percent)}
        </output>
      </div>

      <div className="mt-6 px-1">
        <input
          aria-label={label}
          aria-valuetext={formatValue(value, percent)}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          style={{
            background: `linear-gradient(to right, #60a5fa 0%, #3b82f6 ${progress}%, rgba(255,255,255,0.13) ${progress}%, rgba(255,255,255,0.13) 100%)`,
          }}
          className={`block h-2 w-full cursor-pointer appearance-none rounded-full outline-none
            [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:border-[3px]
            [&::-webkit-slider-thumb]:border-white
            [&::-webkit-slider-thumb]:bg-[#3b82f6]
            [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(59,130,246,0.18),0_2px_8px_rgba(0,0,0,0.35)]
            [&::-moz-range-thumb]:h-3
            [&::-moz-range-thumb]:w-3
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-[3px]
            [&::-moz-range-thumb]:border-white
            [&::-moz-range-thumb]:bg-[#3b82f6]
            focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-4 focus-visible:ring-offset-[#101521]
            ${reduceMotion ? "" : "transition-shadow duration-200 hover:shadow-[0_0_12px_rgba(59,130,246,0.22)]"}`}
        />
      </div>

      <div className="mt-3 flex justify-between text-[10px] font-medium tabular-nums text-white/35">
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
  const isVisualChoice =
    label === "Appearance preset" || label === "Color mode";

  const gradients: Record<string, string> = {
    crispus: "from-slate-950 via-blue-900 to-amber-400",
    crystal: "from-sky-200 via-cyan-400 to-white",
    emerald: "from-emerald-950 via-emerald-500 to-lime-200",
    light: "from-slate-100 via-white to-slate-300",
    dark: "from-slate-950 via-slate-800 to-slate-500",
    sepia: "from-amber-950 via-amber-700 to-amber-200",
  };

  if (isVisualChoice) {
    return (
      <div className="min-w-0">
        <p className="mb-3 text-sm font-semibold text-white/85">
          {label}
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {options.map((option) => {
            const selected = value === option.value;

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(option.value)}
                className={`group relative min-w-0 overflow-hidden rounded-[20px] border p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101521] ${
                  reduceMotion ? "" : "transition-all duration-300 hover:-translate-y-0.5"
                } ${
                  selected
                    ? "border-blue-400/80 bg-blue-400/[0.10] shadow-[0_0_0_1px_rgba(96,165,250,0.22),0_8px_24px_rgba(37,99,235,0.12)]"
                    : "border-white/[0.09] bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.055]"
                }`}
              >
                <div
                  className={`relative h-14 overflow-hidden rounded-xl bg-gradient-to-br ${
                    gradients[option.value] ?? "from-slate-700 to-slate-400"
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/30" />

                  {selected && (
                    <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/50 bg-blue-500 text-xs font-bold text-white shadow-lg">
                      ✓
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-1 px-1 pb-1 pt-3">
                  <span className="truncate text-xs font-semibold text-white/85">
                    {option.label}
                  </span>

                  {selected && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (options.length <= 3) {
    return (
      <div className="min-w-0">
        <p className="mb-3 text-sm font-medium text-white/75">
          {label}
        </p>

        <div
          role="group"
          aria-label={label}
          className="flex min-w-0 flex-wrap gap-1 rounded-2xl border border-white/[0.08] bg-black/20 p-1"
        >
          {options.map((option) => {
            const selected = value === option.value;

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(option.value)}
                className={`min-h-10 min-w-0 flex-1 rounded-xl px-3 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  reduceMotion ? "" : "transition-all duration-200"
                } ${
                  selected
                    ? "border border-white/10 bg-white/[0.13] text-white shadow-[0_2px_10px_rgba(0,0,0,0.16)]"
                    : "border border-transparent text-white/45 hover:bg-white/[0.05] hover:text-white/80"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-medium text-white/75">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`block min-h-12 w-full min-w-0 rounded-2xl border border-white/[0.10] bg-[#101521]/95 px-4 py-3 text-sm text-white outline-none focus:border-blue-400/70 focus:ring-2 focus:ring-blue-400/20 ${
          reduceMotion ? "" : "transition-all duration-200"
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
      className={`flex min-w-0 items-center justify-between gap-4 rounded-[22px] border p-4 backdrop-blur-xl ${
        reduceMotion ? "" : "transition-all duration-300"
      } ${
        checked
          ? "border-blue-400/20 bg-blue-400/[0.055]"
          : "border-white/[0.08] bg-white/[0.025] hover:border-white/[0.15]"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white/85">
          {label}
        </p>
        <p className="mt-1 text-xs leading-5 text-white/45">
          {description}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-[52px] shrink-0 rounded-full border p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101521] ${
          reduceMotion ? "" : "transition-colors duration-300"
        } ${
          checked
            ? "border-blue-400/80 bg-blue-500 shadow-[0_0_14px_rgba(59,130,246,0.22)]"
            : "border-white/15 bg-white/[0.10]"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.3)] ${
            reduceMotion ? "" : "transition-transform duration-300 ease-out"
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

  const reduceMotion =
    Boolean(systemPrefersReducedMotion) ||
    (mode === "personal"
      ? reader.preferences.reduceMotion
      : draftPreferences.reduceMotion);

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
      const persisted = reader.updatePreference(key, value);
      if (!persisted) {
        setMessage("");
        setError("This change applies for the current visit, but browser storage is unavailable so it may not persist after reload.");
        return;
      }
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
      window.dispatchEvent(new Event("display-studio:defaults-updated"));
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
      const persisted = reader.resetPreferences();
      if (!persisted) {
        setMessage("");
        setError("Defaults are active for this visit, but browser storage could not be cleared; the reset may not persist after reload.");
        return;
      }
      setMessage("Personal overrides reset. Your workspace will use the current global defaults.");
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

  const previewAccent =
    preferences.appearancePreset === "emerald"
      ? "#34D399"
      : preferences.appearancePreset === "crystal"
        ? "#67E8F9"
        : preferences.appearancePreset === "light"
          ? "#64748B"
          : "#3B82F6";

  const previewCardBackground =
    preferences.reduceTransparency
      ? preferences.colorMode === "light"
        ? "rgba(245,247,250,0.98)"
        : preferences.colorMode === "sepia"
          ? "rgba(245,231,204,0.98)"
          : "rgba(20,28,42,0.98)"
      : preferences.colorMode === "light"
        ? "rgba(255,255,255,0.48)"
        : preferences.colorMode === "sepia"
          ? "rgba(90,65,35,0.20)"
          : "rgba(255,255,255,0.07)";

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
              {mode === "personal" && (
                <div className="mt-3 space-y-1 text-xs leading-5">
                  <p className="text-white/55">
                    {reader.overriddenPreferenceKeys.length === 0
                      ? "All preferences inherit the latest website defaults."
                      : `${reader.overriddenPreferenceKeys.length} personal override${reader.overriddenPreferenceKeys.length === 1 ? "" : "s"}; the rest inherit the latest website defaults.`}
                  </p>
                  {reader.globalDefaultsStatus === "loading" && (
                    <p role="status" className="text-white/50">Checking website defaults…</p>
                  )}
                  {reader.globalDefaultsStatus === "unavailable" && (
                    <p role="alert" className="text-amber-200">
                      Website defaults are unavailable. Built-in defaults are active until they can be loaded.
                    </p>
                  )}
                  {reader.globalDefaultsStatus === "available" && (
                    <p role="status" className="text-emerald-200">Website defaults are up to date.</p>
                  )}
                </div>
              )}
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

                  <LensGlass
                    className={`relative isolate min-w-0 overflow-hidden rounded-3xl border p-4 sm:p-5 ${
                      reduceMotion ? "" : "transition-all duration-500"
                    }`}
                    glassConfig={{
                      enabled: true,
                      strength: preferences.glassLevel,
                      frost: preferences.reduceTransparency ? 0 : preferences.frostLevel,
                      transparency: preferences.reduceTransparency
                        ? Math.min(preferences.transparency, 0.35)
                        : preferences.transparency,
                      reflection: preferences.reflectionLevel,
                      depth: preferences.glassDepth,
                      radius: 24,
                    }}
                    style={{
                      borderColor: `rgba(255,255,255,${0.1 + preferences.reflectionLevel * 0.35})`,
                      background: preferences.reduceTransparency
                        ? previewBackground
                        : `radial-gradient(circle at 85% 8%, ${previewAccent}30, transparent 42%), ${previewBackground}`,
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
                        borderColor: `${previewAccent}55`,
                        background: previewCardBackground,
                        boxShadow: `0 12px 32px rgba(0,0,0,${preferences.glassDepth * 0.20})`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 shrink-0 rounded-xl ring-1"
                          style={{
                            backgroundColor: `${previewAccent}30`,
                            boxShadow: `inset 0 1px 1px rgba(255,255,255,0.25), 0 4px 16px ${previewAccent}25`,
                            borderColor: `${previewAccent}55`,
                          }}
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

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <span className="text-xs font-medium opacity-60">
                        Primary action style
                      </span>
                      <span
                        aria-hidden="true"
                        className="inline-flex min-h-10 max-w-full items-center rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg"
                        style={{
                          backgroundColor: previewAccent,
                          boxShadow: `0 8px 24px ${previewAccent}35`,
                        }}
                      >
                        Sample action
                      </span>
                    </div>

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
                  </LensGlass>

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
