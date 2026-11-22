
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { RotateCcw, Settings2, X } from "lucide-react";
import type { CSSProperties } from "react";

import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";
import { useReader, type ReaderPreferences } from "@/components/ui/ReaderProvider";

type Props = {
  className: string;
  mobile?: boolean;
  onClose?: () => void;
};

const themes: Array<{
  value: ReaderPreferences["colorMode"];
  label: string;
  symbol: string;
}> = [
  { value: "light", label: "Light", symbol: "☀" },
  { value: "dark", label: "Dark", symbol: "◐" },
  { value: "sepia", label: "Sepia", symbol: "◒" },
];

const presets: Array<{
  value: ReaderPreferences["appearancePreset"];
  label: string;
}> = [
  { value: "crispus", label: "Crispus" },
  { value: "crystal", label: "Crystal" },
  { value: "emerald", label: "Emerald" },
  { value: "light", label: "Quiet Light" },
];

const fonts: Array<{
  value: ReaderPreferences["fontFamily"];
  label: string;
}> = [
  { value: "one-ui", label: "One UI" },
  { value: "samsung-one", label: "SamsungOne" },
  { value: "inter", label: "Inter" },
  { value: "geist", label: "Geist" },
  { value: "system", label: "System" },
  { value: "serif", label: "Editorial" },
  { value: "mono", label: "Mono" },
];

const styles = `
  .ds-glass-panel {
    position: relative;
    isolation: isolate;
    background:
      radial-gradient(ellipse at 12% 0%, rgba(255,255,255,.19), transparent 42%),
      radial-gradient(ellipse at 100% 15%, rgba(125,170,255,.10), transparent 38%),
      linear-gradient(145deg, rgba(255,255,255,.105), rgba(255,255,255,.025));
    backdrop-filter: blur(32px) saturate(175%);
    -webkit-backdrop-filter: blur(32px) saturate(175%);
    box-shadow:
      0 28px 90px rgba(0,0,0,.30),
      0 8px 28px rgba(0,0,0,.14),
      inset 0 1px 0 rgba(255,255,255,.42),
      inset 0 -1px 0 rgba(255,255,255,.08);
    animation: ds-panel-enter .28s cubic-bezier(.2,.8,.2,1) both;
  }

  .ds-glass-panel::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    border-radius: inherit;
    background: linear-gradient(
      125deg,
      rgba(255,255,255,.16),
      transparent 28%,
      transparent 70%,
      rgba(255,255,255,.055)
    );
  }

  .ds-section {
    padding: 13px;
    border: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
    border-radius: 18px;
    background: color-mix(in srgb, var(--surface-solid) 42%, transparent);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.10),
      0 5px 18px rgba(0,0,0,.045);
  }

  .ds-section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 11px;
    font-size: 10px;
    font-weight: 750;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .ds-section-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 65%, transparent);
  }

  .ds-theme-button {
    position: relative;
    display: flex;
    min-height: 43px;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: 1px solid var(--border);
    border-radius: 13px;
    background: rgba(255,255,255,.035);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 650;
    transition:
      background .2s ease,
      border-color .2s ease,
      box-shadow .2s ease,
      transform .2s ease;
  }

  .ds-theme-button:hover {
    transform: translateY(-1px);
    background: var(--surface-hover);
  }

  .ds-theme-button[aria-pressed="true"] {
    border-color: color-mix(in srgb, var(--accent) 75%, white);
    background: color-mix(in srgb, var(--accent) 17%, transparent);
    color: var(--text);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent),
      0 5px 16px color-mix(in srgb, var(--accent) 13%, transparent),
      inset 0 1px 0 rgba(255,255,255,.24);
  }

  .ds-select {
    width: 100%;
    min-height: 39px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--surface-solid) 78%, transparent);
    padding: 0 10px;
    color: var(--text);
    font-size: 12px;
    outline: none;
    transition: border-color .2s ease, box-shadow .2s ease;
  }

  .ds-select:focus-visible {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
  }

  .ds-range-row {
    display: grid;
    gap: 7px;
  }

  .ds-range-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font-size: 11px;
    font-weight: 550;
    color: var(--text);
  }

  .ds-range-value {
    min-width: 39px;
    padding: 3px 7px;
    border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
    border-radius: 8px;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--text);
    text-align: center;
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  }

  .ds-range {
    width: 100%;
    height: 6px;
    margin: 3px 0;
    appearance: none;
    -webkit-appearance: none;
    border-radius: 99px;
    background: linear-gradient(
      to right,
      var(--accent) 0%,
      var(--accent) var(--range-progress),
      color-mix(in srgb, var(--text-muted) 20%, transparent) var(--range-progress),
      color-mix(in srgb, var(--text-muted) 20%, transparent) 100%
    );
    cursor: pointer;
    outline: none;
  }

  .ds-range::-webkit-slider-thumb {
    width: 17px;
    height: 17px;
    appearance: none;
    -webkit-appearance: none;
    border: 2px solid rgba(255,255,255,.95);
    border-radius: 50%;
    background: var(--accent);
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent),
      0 2px 8px rgba(0,0,0,.24);
    transition: transform .16s ease, box-shadow .16s ease;
  }

  .ds-range::-moz-range-thumb {
    width: 13px;
    height: 13px;
    border: 2px solid rgba(255,255,255,.95);
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
  }

  .ds-range:hover::-webkit-slider-thumb {
    transform: scale(1.16);
    box-shadow:
      0 0 0 5px color-mix(in srgb, var(--accent) 18%, transparent),
      0 2px 10px rgba(0,0,0,.28);
  }

  .ds-range:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 5px;
  }

  .ds-toggle-row {
    display: flex;
    min-height: 39px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 11px;
    font-weight: 550;
    color: var(--text);
  }

  .ds-switch {
    position: relative;
    display: inline-flex;
    width: 42px;
    height: 24px;
    flex: 0 0 auto;
    align-items: center;
    border: 1px solid var(--border);
    border-radius: 99px;
    background: color-mix(in srgb, var(--text-muted) 19%, transparent);
    padding: 2px;
    cursor: pointer;
    transition:
      background .22s ease,
      border-color .22s ease,
      box-shadow .22s ease;
  }

  .ds-switch[aria-checked="true"] {
    border-color: color-mix(in srgb, var(--accent) 80%, white);
    background: color-mix(in srgb, var(--accent) 85%, transparent);
    box-shadow: 0 0 13px color-mix(in srgb, var(--accent) 28%, transparent);
  }

  .ds-switch-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: linear-gradient(145deg, #fff, #dce5f2);
    box-shadow: 0 2px 5px rgba(0,0,0,.25);
    transition: transform .22s cubic-bezier(.2,.8,.2,1);
  }

  .ds-switch[aria-checked="true"] .ds-switch-thumb {
    transform: translateX(18px);
  }

  .ds-switch:focus-visible,
  .ds-theme-button:focus-visible,
  .ds-action:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }

  .ds-action {
    display: inline-flex;
    min-height: 37px;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0 11px;
    background: rgba(255,255,255,.045);
    color: var(--text);
    font-size: 11px;
    font-weight: 650;
    transition: background .2s ease, transform .2s ease;
  }

  .ds-action:hover {
    transform: translateY(-1px);
    background: var(--surface-hover);
  }

  .ds-panel-scroll {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 12px;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--text-muted) 35%, transparent) transparent;
  }

  .ds-panel-scroll::-webkit-scrollbar {
    width: 5px;
  }

  .ds-panel-scroll::-webkit-scrollbar-thumb {
    border-radius: 99px;
    background: color-mix(in srgb, var(--text-muted) 30%, transparent);
  }

  .ds-dialog {
    width: 100%;
    max-width: 100%;
    height: 100%;
    max-height: 100%;
    margin: 0;
    border: 0;
    padding: 0;
    overflow: visible;
    background: transparent;
    color: var(--text);
  }

  .ds-dialog::backdrop {
    background: rgba(5, 10, 22, .30);
    backdrop-filter: blur(7px);
    -webkit-backdrop-filter: blur(7px);
    animation: ds-backdrop-enter .2s ease both;
  }

  @keyframes ds-panel-enter {
    from { opacity: 0; transform: translateY(9px) scale(.985); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes ds-backdrop-enter {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .ds-reduced-motion,
  .ds-reduced-motion *,
  .ds-reduced-motion *::before,
  .ds-reduced-motion *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }

  @media (max-width: 640px) {
    .ds-panel-scroll {
      padding: 10px;
    }

    .ds-section {
      padding: 11px;
      border-radius: 15px;
    }

    .ds-glass-panel {
      backdrop-filter: blur(25px) saturate(165%);
      -webkit-backdrop-filter: blur(25px) saturate(165%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ds-glass-panel,
    .ds-glass-panel *,
    .ds-glass-panel *::before,
    .ds-glass-panel *::after {
      animation: none !important;
      transition: none !important;
      scroll-behavior: auto !important;
    }
  }
`;

function RangeSetting({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const percentage = Math.round(((value - min) / (max - min)) * 100);

  return (
    <label className="ds-range-row">
      <span className="ds-range-heading">
        <span>{label}</span>
        <output className="ds-range-value">{percentage}%</output>
      </span>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
        aria-valuetext={`${percentage}%`}
        className="ds-range"
        style={
          {
            "--range-progress": `${percentage}%`,
          } as CSSProperties
        }
      />
    </label>
  );
}

function ChoiceSetting<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-[10px] font-semibold text-[var(--text-muted)]">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="ds-select"
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

function ToggleSetting({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="ds-toggle-row">
      <span>{label}</span>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="ds-switch"
      >
        <span className="ds-switch-thumb" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Personal reader controls. Personal values never modify global defaults. */
export function DisplayStudioControlCentre({
  className,
  mobile = false,
  onClose,
}: Props) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogId = `display-studio-panel-${useId().replace(/:/g, "")}`;

  const reader = useReader();
  const { preferences } = reader;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function closePanel() {
    setOpen(false);
  }

  const panelStyle: CSSProperties = {
    position: "fixed",
    top: mobile ? "12px" : "84px",
    right: mobile ? "12px" : "clamp(12px, calc((100vw - 1280px) / 2), 32px)",
    display: "flex",
    width: mobile ? "min(430px, calc(100vw - 24px))" : "min(430px, calc(100vw - 24px))",
    maxHeight: mobile ? "calc(100dvh - 24px)" : "calc(100dvh - 100px)",
    flexDirection: "column",
    overflow: "hidden",
    border: "1px solid var(--liquid-edge, var(--border))",
    borderRadius: 26,
    color: "var(--text)",
    background: "color-mix(in srgb, var(--surface-solid) 76%, transparent)",
    boxShadow: "var(--shadow)",
  };

  return (
    <>
      <style>{styles}</style>

      <button
        ref={triggerRef}
        type="button"
        className={`${className} navbar-icon-control ${
          open ? "navbar-icon-control-active" : ""
        }`}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Appearance settings"
        title="Appearance settings"
        data-tooltip="Appearance settings"
        aria-controls={dialogId}
        data-display-studio-open={open ? "true" : undefined}
      >
        <Settings2 aria-hidden="true" />
        <span className="sr-only">Appearance settings</span>
      </button>

      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-labelledby={`${dialogId}-title`}
        onClose={() => {
          setOpen(false);
          onClose?.();
          triggerRef.current?.focus({ preventScroll: true });
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            closePanel();
          }
        }}
        className="ds-dialog display-studio-dialog"
      >
        <LiquidLensSurface
          radius={26}
          intensity="medium"
          className={`display-studio-panel ds-glass-panel ${
            preferences.reduceMotion ? "ds-reduced-motion" : ""
          }`}
          style={panelStyle}
          aria-describedby={`${dialogId}-description`}
        >
          <header className="relative flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]" />
                <p className="text-[9px] font-bold uppercase tracking-[.19em] text-[var(--accent)]">
                  Personal appearance
                </p>
              </div>

              <h2
                id={`${dialogId}-title`}
                className="mt-1 text-lg font-bold tracking-tight text-[var(--text)]"
              >
                Display Studio
              </h2>

              <p
                id={`${dialogId}-description`}
                className="mt-0.5 text-[10px] leading-4 text-[var(--text-muted)]"
              >
                Fine-tune your personal reading experience.
              </p>

              <p
                className="mt-1 text-[10px] font-medium text-[var(--text-muted)]"
                role="status"
                aria-live="polite"
              >
                {reader.overriddenPreferenceKeys.length === 0
                  ? "● Inheriting website defaults"
                  : `● ${reader.overriddenPreferenceKeys.length} personal override${
                      reader.overriddenPreferenceKeys.length === 1 ? "" : "s"
                    }`}
              </p>
            </div>

            <button
              type="button"
              onClick={closePanel}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-white/[0.06] text-[var(--text)] shadow-sm transition hover:rotate-90 hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label="Close appearance settings"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </header>

          <div className="ds-panel-scroll">
            <div className="grid gap-2.5">
              <section
                aria-labelledby={`${dialogId}-theme`}
                className="ds-section"
              >
                <h3
                  id={`${dialogId}-theme`}
                  className="ds-section-title"
                >
                  <span className="ds-section-dot" />
                  Appearance
                </h3>

                <div
                  className="grid grid-cols-3 gap-2"
                  role="group"
                  aria-label="Color theme"
                >
                  {themes.map((theme) => (
                    <button
                      key={theme.value}
                      type="button"
                      aria-pressed={preferences.colorMode === theme.value}
                      onClick={() =>
                        reader.updatePreference("colorMode", theme.value)
                      }
                      className="ds-theme-button"
                    >
                      <span aria-hidden="true">{theme.symbol}</span>
                      {theme.label}
                    </button>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <ChoiceSetting
                    label="Reading preset"
                    value={preferences.appearancePreset}
                    options={presets}
                    onChange={(value) =>
                      reader.updatePreference("appearancePreset", value)
                    }
                  />

                  <ChoiceSetting
                    label="Typography"
                    value={preferences.fontFamily}
                    options={fonts}
                    onChange={(value) =>
                      reader.updatePreference("fontFamily", value)
                    }
                  />
                </div>
              </section>

              <section
                aria-labelledby={`${dialogId}-glass`}
                className="ds-section"
              >
                <h3
                  id={`${dialogId}-glass`}
                  className="ds-section-title"
                >
                  <span className="ds-section-dot" />
                  Liquid Glass
                  <span className="ml-auto rounded-full border border-[var(--border)] px-2 py-0.5 text-[9px] font-medium normal-case tracking-normal">
                    Live controls
                  </span>
                </h3>

                <div className="grid gap-3">
                  <RangeSetting
                    label="Glass intensity"
                    value={preferences.glassLevel}
                    min={0}
                    max={1}
                    onChange={(value) =>
                      reader.updatePreference("glassLevel", value)
                    }
                  />

                  <RangeSetting
                    label="Transparency"
                    value={preferences.transparency}
                    min={0}
                    max={1}
                    onChange={(value) =>
                      reader.updatePreference("transparency", value)
                    }
                  />

                  <RangeSetting
                    label="Frost and blur"
                    value={preferences.frostLevel}
                    min={0}
                    max={1}
                    onChange={(value) =>
                      reader.updatePreference("frostLevel", value)
                    }
                  />

                  <RangeSetting
                    label="Reflection"
                    value={preferences.reflectionLevel}
                    min={0}
                    max={1}
                    onChange={(value) =>
                      reader.updatePreference("reflectionLevel", value)
                    }
                  />

                  <RangeSetting
                    label="Depth"
                    value={preferences.glassDepth}
                    min={0}
                    max={1}
                    onChange={(value) =>
                      reader.updatePreference("glassDepth", value)
                    }
                  />
                </div>
              </section>

              <section
                aria-labelledby={`${dialogId}-reading`}
                className="ds-section"
              >
                <h3
                  id={`${dialogId}-reading`}
                  className="ds-section-title"
                >
                  <span className="ds-section-dot" />
                  Reading experience
                </h3>

                <div className="grid gap-3">
                  <RangeSetting
                    label="Text size"
                    value={(preferences.textScale - 0.8) / 0.8}
                    min={0}
                    max={1}
                    onChange={(value) =>
                      reader.updatePreference(
                        "textScale",
                        Number((0.8 + value * 0.8).toFixed(2))
                      )
                    }
                  />

                  <div className="grid grid-cols-2 gap-2.5">
                    <ChoiceSetting
                      label="Content width"
                      value={preferences.readingWidth}
                      options={[
                        { value: "normal", label: "Comfort" },
                        { value: "wide", label: "Wide" },
                      ]}
                      onChange={(value) =>
                        reader.updatePreference("readingWidth", value)
                      }
                    />

                    <ChoiceSetting
                      label="Line spacing"
                      value={preferences.lineHeight}
                      options={[
                        { value: "normal", label: "Standard" },
                        { value: "relaxed", label: "Relaxed" },
                        { value: "loose", label: "Open" },
                      ]}
                      onChange={(value) =>
                        reader.updatePreference("lineHeight", value)
                      }
                    />
                  </div>

                  <ChoiceSetting
                    label="Letter spacing"
                    value={preferences.letterSpacing}
                    options={[
                      { value: "normal", label: "Standard" },
                      { value: "wide", label: "Wide" },
                      { value: "wider", label: "Wider" },
                    ]}
                    onChange={(value) =>
                      reader.updatePreference("letterSpacing", value)
                    }
                  />
                </div>

                <div className="mt-3 border-t border-[var(--border)] pt-2">
                  <ToggleSetting
                    label="Reduce motion"
                    checked={preferences.reduceMotion}
                    onChange={(checked) =>
                      reader.updatePreference("reduceMotion", checked)
                    }
                  />

                  <ToggleSetting
                    label="Reduce transparency"
                    checked={preferences.reduceTransparency}
                    onChange={(checked) =>
                      reader.updatePreference("reduceTransparency", checked)
                    }
                  />

                  <ToggleSetting
                    label="Increase contrast"
                    checked={preferences.highContrast}
                    onChange={(checked) =>
                      reader.updatePreference("highContrast", checked)
                    }
                  />

                  <ToggleSetting
                    label="Underline links"
                    checked={preferences.underlineLinks}
                    onChange={(checked) =>
                      reader.updatePreference("underlineLinks", checked)
                    }
                  />
                </div>
              </section>
            </div>
          </div>

          <footer className="relative flex shrink-0 items-center justify-between gap-2 border-t border-[var(--border)] bg-white/[0.025] px-3.5 py-3 sm:px-4">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold text-[var(--text-muted)]">
                {reader.globalDefaultsStatus === "unavailable"
                  ? "Using built-in defaults"
                  : "Personal settings saved"}
              </p>
              <p className="mt-0.5 text-[9px] text-[var(--text-muted)]">
                Website defaults remain unchanged.
              </p>
            </div>

            <button
              type="button"
              onClick={() => reader.resetPreferences()}
              className="ds-action shrink-0"
            >
              <RotateCcw size={13} aria-hidden="true" />
              Reset overrides
            </button>
          </footer>
        </LiquidLensSurface>
      </dialog>
    </>
  );
}
