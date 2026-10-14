
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type ReaderPreferences = {
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

export const defaultReaderPreferences: ReaderPreferences = {
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

const STORAGE_KEY = "reader-preferences";
const listeners = new Set<() => void>();
const EMPTY_SNAPSHOT = "{}";

type PreferenceOverrides = Partial<ReaderPreferences>;

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function getSystemReducedMotion() {
  if (typeof window === "undefined") return false;

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function applyReaderPreferences(preferences: ReaderPreferences) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  root.setAttribute("data-theme", preferences.colorMode);
  root.setAttribute(
    "data-appearance-preset",
    preferences.appearancePreset,
  );
  root.setAttribute(
    "data-high-contrast",
    String(preferences.highContrast),
  );
  root.setAttribute(
    "data-reduce-transparency",
    String(preferences.reduceTransparency),
  );
  root.setAttribute(
    "data-underline-links",
    String(preferences.underlineLinks),
  );
  root.setAttribute("data-focus-mode", String(preferences.focusMode));
  root.setAttribute(
    "data-reduce-motion",
    String(preferences.reduceMotion || getSystemReducedMotion()),
  );

  root.style.setProperty(
    "--reader-text-scale",
    String(preferences.textScale),
  );

  const lineHeights: Record<ReaderPreferences["lineHeight"], string> = {
    normal: "1.6",
    relaxed: "1.8",
    loose: "2",
  };

  const letterSpacings: Record<
    ReaderPreferences["letterSpacing"],
    string
  > = {
    normal: "normal",
    wide: "0.04em",
    wider: "0.08em",
  };

  const fontFamilies: Record<ReaderPreferences["fontFamily"], string> = {
    "one-ui":
      "'SamsungOne', 'Samsung One UI', 'Segoe UI', Roboto, Arial, sans-serif",
    "samsung-one":
      "'SamsungOne', 'Segoe UI', Roboto, Arial, sans-serif",
    inter: "'Inter', Arial, sans-serif",
    geist: "'Geist', 'Inter', Arial, sans-serif",
    system:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    mono: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
  };

  root.style.setProperty(
    "--reader-line-height",
    lineHeights[preferences.lineHeight],
  );
  root.style.setProperty(
    "--reader-letter-spacing",
    letterSpacings[preferences.letterSpacing],
  );
  root.style.setProperty(
    "--reader-font-family",
    fontFamilies[preferences.fontFamily],
  );

  const glass = clamp(preferences.glassLevel);
  const frost = clamp(preferences.frostLevel);
  const transparency = clamp(preferences.transparency);
  const reflection = clamp(preferences.reflectionLevel);
  const depth = clamp(preferences.glassDepth);

  root.style.setProperty("--site-glass-level", String(glass));
  root.style.setProperty("--site-glass-frost", String(frost));
  root.style.setProperty("--site-glass-transparency", String(transparency));
  root.style.setProperty("--site-glass-reflection", String(reflection));
  root.style.setProperty("--site-glass-depth", String(depth));

  root.style.setProperty("--site-glass-blur", `${2 + frost * 28}px`);
  root.style.setProperty(
    "--site-glass-saturation",
    `${110 + glass * 70}%`,
  );
  root.style.setProperty(
    "--site-glass-tint",
    `${(0.025 + (1 - transparency) * 0.2) * 100}%`,
  );
  root.style.setProperty(
    "--site-glass-edge",
    `${(0.1 + reflection * 0.35) * 100}%`,
  );
  root.style.setProperty(
    "--site-glass-highlight",
    `${(0.06 + reflection * 0.24) * 100}%`,
  );
  root.style.setProperty("--site-glass-shadow", String(0.04 + depth * 0.12));

  root.style.setProperty(
    "--reader-reading-width",
    preferences.readingWidth === "wide" ? "100%" : "760px",
  );
}

function subscribe(callback: () => void) {
  listeners.add(callback);

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      callback();
    }
  };

  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", handleStorage);
  };
}

function getClientSnapshot() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? EMPTY_SNAPSHOT;
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

function getServerSnapshot() {
  return EMPTY_SNAPSHOT;
}

function isOneOf<T extends string>(
  value: unknown,
  options: readonly T[],
): value is T {
  return options.some((option) => option === value);
}

function numberOrDefault(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function booleanOrDefault(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function parsePreferences(snapshot: string): ReaderPreferences {
  try {
    const parsed = JSON.parse(snapshot) as Partial<ReaderPreferences>;

    return {
      textScale: clamp(
        numberOrDefault(
          parsed.textScale,
          defaultReaderPreferences.textScale,
        ),
        0.8,
        1.6,
      ),

      readingWidth: isOneOf(parsed.readingWidth, ["normal", "wide"])
        ? parsed.readingWidth
        : defaultReaderPreferences.readingWidth,

      fontFamily: isOneOf(parsed.fontFamily, [
        "one-ui",
        "samsung-one",
        "inter",
        "geist",
        "system",
        "serif",
        "mono",
      ])
        ? parsed.fontFamily
        : defaultReaderPreferences.fontFamily,

      glassLevel: clamp(
        numberOrDefault(
          parsed.glassLevel,
          defaultReaderPreferences.glassLevel,
        ),
      ),

      frostLevel: clamp(
        numberOrDefault(
          parsed.frostLevel,
          defaultReaderPreferences.frostLevel,
        ),
      ),

      transparency: clamp(
        numberOrDefault(
          parsed.transparency,
          defaultReaderPreferences.transparency,
        ),
      ),

      reflectionLevel: clamp(
        numberOrDefault(
          parsed.reflectionLevel,
          defaultReaderPreferences.reflectionLevel,
        ),
      ),

      glassDepth: clamp(
        numberOrDefault(
          parsed.glassDepth,
          defaultReaderPreferences.glassDepth,
        ),
      ),

      appearancePreset: isOneOf(parsed.appearancePreset, [
        "crispus",
        "crystal",
        "emerald",
        "light",
      ])
        ? parsed.appearancePreset
        : defaultReaderPreferences.appearancePreset,

      lineHeight: isOneOf(parsed.lineHeight, [
        "normal",
        "relaxed",
        "loose",
      ])
        ? parsed.lineHeight
        : defaultReaderPreferences.lineHeight,

      letterSpacing: isOneOf(parsed.letterSpacing, [
        "normal",
        "wide",
        "wider",
      ])
        ? parsed.letterSpacing
        : defaultReaderPreferences.letterSpacing,

      colorMode: isOneOf(parsed.colorMode, ["dark", "light", "sepia"])
        ? parsed.colorMode
        : defaultReaderPreferences.colorMode,

      highContrast: booleanOrDefault(
        parsed.highContrast,
        defaultReaderPreferences.highContrast,
      ),

      reduceMotion: booleanOrDefault(
        parsed.reduceMotion,
        defaultReaderPreferences.reduceMotion,
      ),

      reduceTransparency: booleanOrDefault(
        parsed.reduceTransparency,
        defaultReaderPreferences.reduceTransparency,
      ),

      underlineLinks: booleanOrDefault(
        parsed.underlineLinks,
        defaultReaderPreferences.underlineLinks,
      ),

      focusMode: booleanOrDefault(
        parsed.focusMode,
        defaultReaderPreferences.focusMode,
      ),
    };
  } catch {
    return defaultReaderPreferences;
  }
}

function parsePreferenceOverrides(
  snapshot: string,
): PreferenceOverrides {
  try {
    const stored = JSON.parse(snapshot) as Record<string, unknown>;

    if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
      return {};
    }

    const isNewFormat =
      stored.overrides !== null &&
      typeof stored.overrides === "object" &&
      !Array.isArray(stored.overrides);

    const candidate: Record<string, unknown> = isNewFormat
      ? (stored.overrides as Record<string, unknown>)
      : stored;

    const validated = parsePreferences(
      JSON.stringify({
        ...defaultReaderPreferences,
        ...candidate,
      }),
    );

    const overrides: PreferenceOverrides = {};

    for (const key of Object.keys(defaultReaderPreferences) as Array<
      keyof ReaderPreferences
    >) {
      if (!(key in candidate)) continue;

      // Keep legacy migration behavior while allowing global defaults to change.
      if (
        !isNewFormat &&
        Object.is(candidate[key], defaultReaderPreferences[key])
      ) {
        continue;
      }

      Object.assign(overrides, {
        [key]: validated[key],
      });
    }

    return overrides;
  } catch {
    return {};
  }
}

type ReaderContextValue = {
  preferences: ReaderPreferences;
  updatePreference: <K extends keyof ReaderPreferences>(
    key: K,
    value: ReaderPreferences[K],
  ) => void;
  resetPreferences: () => void;
};

const ReaderContext = createContext<ReaderContextValue | null>(null);

export function ReaderProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const [globalPreferences, setGlobalPreferences] =
    useState<ReaderPreferences>(defaultReaderPreferences);

  // Load the latest defaults configured by the Super Admin.
  useEffect(() => {
    let active = true;

    async function loadGlobalPreferences() {
      try {
        const response = await fetch("/api/display-studio", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = (await response.json()) as {
          preferences?: Partial<ReaderPreferences>;
        };

        if (!active || !data.preferences) return;

        setGlobalPreferences(
          parsePreferences(
            JSON.stringify({
              ...defaultReaderPreferences,
              ...data.preferences,
            }),
          ),
        );
      } catch {
        // Keep the built-in defaults if the API is unavailable.
      }
    }

    void loadGlobalPreferences();

    return () => {
      active = false;
    };
  }, []);

  const preferences = useMemo(
    () =>
      parsePreferences(
        JSON.stringify({
          ...globalPreferences,
          ...parsePreferenceOverrides(snapshot),
        }),
      ),
    [snapshot, globalPreferences],
  );

  useEffect(() => {
    applyReaderPreferences(preferences);
  }, [preferences]);

  // Apply operating-system motion preference changes immediately.
  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    const handleMotionChange = () => {
      applyReaderPreferences(preferences);
    };

    mediaQuery.addEventListener("change", handleMotionChange);

    return () => {
      mediaQuery.removeEventListener("change", handleMotionChange);
    };
  }, [preferences]);

  const updatePreference = useCallback(
    function updatePreference<K extends keyof ReaderPreferences>(
      key: K,
      value: ReaderPreferences[K],
    ) {
      const overrides = parsePreferenceOverrides(getClientSnapshot());

      if (Object.is(value, globalPreferences[key])) {
        delete overrides[key];
      } else {
        Object.assign(overrides, { [key]: value });
      }

      const nextPreferences = parsePreferences(
        JSON.stringify({
          ...globalPreferences,
          ...overrides,
        }),
      );

      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            version: 2,
            overrides,
          }),
        );
      } catch {
        // Apply the setting even if browser storage is unavailable.
      }

      applyReaderPreferences(nextPreferences);
      notifyListeners();
    },
    [globalPreferences],
  );

  const resetPreferences = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Still reset the current interface if storage is unavailable.
    }

    applyReaderPreferences(globalPreferences);
    notifyListeners();
  }, [globalPreferences]);

  const contextValue = useMemo(
    () => ({
      preferences,
      updatePreference,
      resetPreferences,
    }),
    [preferences, updatePreference, resetPreferences],
  );

  return (
    <ReaderContext.Provider value={contextValue}>
      {children}
    </ReaderContext.Provider>
  );
}

export function useReader() {
  const context = useContext(ReaderContext);

  if (!context) {
    throw new Error("useReader must be used inside ReaderProvider.");
  }

  return context;
}