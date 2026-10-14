
"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { LensGlass } from "@/components/ui/LensGlass";
import { AnimatePresence, motion } from "motion/react";
import {
  useReader,
  type ReaderPreferences,
} from "@/components/ui/ReaderProvider";

const links = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "How It Works", href: "/solutions" },
  { label: "Insights", href: "/insights" },
];

type ReaderSectionProps = {
  title: string;
  eyebrow: string;
  children: ReactNode;
  expanded: boolean;
  onToggle: () => void;
};

function ReaderSection({
  title,
  eyebrow,
  children,
  expanded,
  onToggle,
}: ReaderSectionProps) {
  const panelId = `reader-section-${eyebrow}`;

  return (
    <section className="reader-section">
      <button
        type="button"
        className="reader-section-heading reader-section-trigger"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="reader-section-heading-copy">
          <span className="reader-eyebrow">{eyebrow}</span>
          <span className="reader-section-title">{title}</span>
        </span>

        <span
          className={`reader-section-chevron ${
            expanded ? "reader-section-chevron-open" : ""
          }`}
          aria-hidden="true"
        >
          ⌄
        </span>
      </button>

      <div
        id={panelId}
        className={`reader-section-panel ${
          expanded ? "reader-section-panel-open" : ""
        }`}
        hidden={!expanded}
      >
        {children}
      </div>
    </section>
  );
}

type ChoiceProps<T extends string> = {
  value: T;
  active: boolean;
  label: string;
  onClick: () => void;
  preview?: ReactNode;
};

function ReaderChoice<T extends string>({
  active,
  label,
  onClick,
  preview,
}: ChoiceProps<T>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "reader-choice",
        active ? "reader-choice-active" : "",
      ].join(" ")}
    >
      {preview && (
        <span className="reader-choice-preview">{preview}</span>
      )}

      <span className="reader-choice-label">{label}</span>

      <span aria-hidden="true" className="reader-choice-check">
        {active ? "✓" : ""}
      </span>
    </button>
  );
}

type ReaderToggleProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function ReaderToggle({
  label,
  description,
  checked,
  onChange,
}:
ReaderToggleProps) {
  return (
    <div className="reader-accessibility-row">
      <div className="reader-accessibility-copy">
        <span className="reader-accessibility-label">{label}</span>
        <span className="reader-accessibility-description">
          {description}
        </span>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        data-active={checked ? "true" : "false"}
        className="liquid-reader-toggle"
        onClick={() => onChange(!checked)}
      >
        <span className="liquid-reader-toggle-track">
          <span className="liquid-reader-toggle-knob" />
        </span>
      </button>
    </div>
  );
}

type StudioSliderProps = {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  leftLabel: string;
  rightLabel: string;
};

function StudioSlider({
  label,
  description,
  value,
  onChange,
  leftLabel,
  rightLabel,
}: StudioSliderProps) {
  const percentage = Math.round(value * 100);

  return (
    <div className="iphone-display-settings">
      <div className="iphone-settings-heading">
        <div>
          <span className="reader-eyebrow">LIVE CONTROL</span>
          <h3 className="iphone-settings-title">{label}</h3>
        </div>

        <span className="iphone-glass-value">{percentage}%</span>
      </div>

      <div className="iphone-slider-heading">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>

      <input
        className="iphone-glass-slider"
        type="range"
        min="0"
        max="100"
        step="1"
        value={percentage}
        aria-label={label}
        aria-valuetext={`${percentage}%`}
        onChange={(event) =>
          onChange(Number(event.target.value) / 100)
        }
        style={
          {
            "--glass-progress": `${percentage}%`,
          } as CSSProperties
        }
      />

      <p className="iphone-slider-hint">{description}</p>
    </div>
  );
}

type ReaderConsoleProps = {
  onClose: () => void;
  glassLevel: number;
  onGlassLevelChange: (value: number) => void;
};

function ReaderConsole({
  onClose,
  glassLevel,
  onGlassLevelChange,
}: ReaderConsoleProps) {
  const {
    preferences,
    updatePreference,
    resetPreferences,
  } = useReader();

  const [expandedSection, setExpandedSection] = useState("01");

  const toggleSection = (eyebrow: string) => {
    setExpandedSection((current) =>
      current === eyebrow ? "" : eyebrow
    );
  };

  const set = <K extends keyof ReaderPreferences>(
    key: K,
    value: ReaderPreferences[K]
  ) => {
    updatePreference(key, value);
  };

  const increaseText = () => {
    set(
      "textScale",
      Math.min(Number((preferences.textScale + 0.1).toFixed(1)), 1.6)
    );
  };

  const decreaseText = () => {
    set(
      "textScale",
      Math.max(Number((preferences.textScale - 0.1).toFixed(1)), 0.8)
    );
  };

  const glassPercentage = Math.round(glassLevel * 100);

const applyPreset = (
  preset: ReaderPreferences["appearancePreset"]
) => {
  const presets: Record<
    ReaderPreferences["appearancePreset"],
    {
      colorMode: ReaderPreferences["colorMode"];
      glassLevel: number;
      frostLevel: number;
      transparency: number;
      reflectionLevel: number;
      glassDepth: number;
    }
  > = {
    crispus: {
      colorMode: "dark",
      glassLevel: 0.72,
      frostLevel: 0,
      transparency: 0.72,
      reflectionLevel: 0.65,
      glassDepth: 0.65,
    },
    crystal: {
      colorMode: "dark",
      glassLevel: 0.9,
      frostLevel: 0,
      transparency: 0.95,
      reflectionLevel: 0.9,
      glassDepth: 0.8,
    },
    emerald: {
      colorMode: "dark",
      glassLevel: 0.7,
      frostLevel: 0.12,
      transparency: 0.68,
      reflectionLevel: 0.7,
      glassDepth: 0.75,
    },
    light: {
      colorMode: "light",
      glassLevel: 0.55,
      frostLevel: 0.2,
      transparency: 0.8,
      reflectionLevel: 0.5,
      glassDepth: 0.4,
    },
  };

  const selected = presets[preset];

  set("appearancePreset", preset);
  set("colorMode", selected.colorMode);
  set("glassLevel", selected.glassLevel);
  set("frostLevel", selected.frostLevel);
  set("transparency", selected.transparency);
  set("reflectionLevel", selected.reflectionLevel);
  set("glassDepth", selected.glassDepth);
};
  return (
  <motion.div
    className="reader-console"
    initial={{ opacity: 0, y: -8, scale: 0.985 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: -6, scale: 0.985 }}
    transition={{
      type: "spring",
      stiffness: 420,
      damping: 34,
    }}
  >
      <div className="reader-console-glow" />

      <div className="reader-console-inner">
        <div className="reader-console-header">
          <div>
            <span className="reader-console-kicker">
              DISPLAY STUDIO
            </span>

            <h2 className="reader-console-title">
              Your reading space
            </h2>

            <p className="reader-console-subtitle">
              A more personal reading experience, designed around
              your comfort and preferences.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close reader tools"
            className="reader-close"
          >
            <span />
            <span />
          </button>
        </div>

        <div className="reader-console-content">
          <ReaderSection
            eyebrow="01"
            title="Typography"
            expanded={expandedSection === "01"}
            onToggle={() => toggleSection("01")}
          >
            <div className="reader-size-card">
              <div className="reader-size-copy">
                <span className="reader-size-label">Text size</span>
                <strong>
                  {Math.round(preferences.textScale * 100)}%
                </strong>
              </div>

              <div className="reader-size-controls">
                <button
                  type="button"
                  onClick={decreaseText}
                  disabled={preferences.textScale <= 0.8}
                  aria-label="Decrease text size"
                  className="reader-size-button"
                >
                  A<span>−</span>
                </button>

                <div
                  className="reader-size-track"
                  role="progressbar"
                  aria-label="Text size"
                  aria-valuemin={80}
                  aria-valuemax={160}
                  aria-valuenow={Math.round(
                    preferences.textScale * 100
                  )}
                >
                  <span
                    className="reader-size-track-fill"
                    style={{
                      width: `${
                        ((preferences.textScale - 0.8) / 0.8) * 100
                      }%`,
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={increaseText}
                  disabled={preferences.textScale >= 1.6}
                  aria-label="Increase text size"
                  className="reader-size-button reader-size-button-large"
                >
                  A<span>+</span>
                </button>
              </div>
            </div>

           
<div className="reader-choice-grid reader-font-grid">
  <ReaderChoice
    value="one-ui"
    active={preferences.fontFamily === "one-ui"}
    label="One UI"
    onClick={() => set("fontFamily", "one-ui")}
    preview={<span className="font-sans text-xl">Aa</span>}
  />

  <ReaderChoice
    value="samsung-one"
    active={preferences.fontFamily === "samsung-one"}
    label="SamsungOne"
    onClick={() => set("fontFamily", "samsung-one")}
    preview={<span className="font-sans text-xl">Ag</span>}
  />

  <ReaderChoice
    value="inter"
    active={preferences.fontFamily === "inter"}
    label="Inter"
    onClick={() => set("fontFamily", "inter")}
    preview={<span className="font-sans text-xl">Aa</span>}
  />

  <ReaderChoice
    value="geist"
    active={preferences.fontFamily === "geist"}
    label="Geist"
    onClick={() => set("fontFamily", "geist")}
    preview={<span className="font-sans text-xl">Ag</span>}
  />

  <ReaderChoice
    value="system"
    active={preferences.fontFamily === "system"}
    label="System"
    onClick={() => set("fontFamily", "system")}
    preview={<span className="font-sans text-xl">Aa</span>}
  />

  <ReaderChoice
    value="serif"
    active={preferences.fontFamily === "serif"}
    label="Editorial"
    onClick={() => set("fontFamily", "serif")}
    preview={<span className="font-serif text-xl">Aa</span>}
  />

  <ReaderChoice
    value="mono"
    active={preferences.fontFamily === "mono"}
    label="Mono"
    onClick={() => set("fontFamily", "mono")}
    preview={<span className="font-mono text-xl">Aa</span>}
  />
</div>
            <div className="reader-choice-grid">
              <ReaderChoice
                value="normal"
                active={preferences.lineHeight === "normal"}
                label="Compact"
                onClick={() => set("lineHeight", "normal")}
                preview={
                  <span className="reader-lines reader-lines-compact">
                    ━<br />━<br />━
                  </span>
                }
              />

              <ReaderChoice
                value="relaxed"
                active={preferences.lineHeight === "relaxed"}
                label="Relaxed"
                onClick={() => set("lineHeight", "relaxed")}
                preview={
                  <span className="reader-lines">
                    ━<br />━<br />━
                  </span>
                }
              />

              <ReaderChoice
                value="loose"
                active={preferences.lineHeight === "loose"}
                label="Airy"
                onClick={() => set("lineHeight", "loose")}
                preview={
                  <span className="reader-lines reader-lines-airy">
                    ━<br />━<br />━
                  </span>
                }
              />
            </div>

            <div className="reader-choice-grid">
              <ReaderChoice
                value="normal"
                active={preferences.letterSpacing === "normal"}
                label="Default"
                onClick={() => set("letterSpacing", "normal")}
              />

              <ReaderChoice
                value="wide"
                active={preferences.letterSpacing === "wide"}
                label="Wide"
                onClick={() => set("letterSpacing", "wide")}
              />

              <ReaderChoice
                value="wider"
                active={preferences.letterSpacing === "wider"}
                label="Open"
                onClick={() => set("letterSpacing", "wider")}
              />
            </div>
          </ReaderSection>

          <ReaderSection
            eyebrow="02"
            title="Reading width"
            expanded={expandedSection === "02"}
            onToggle={() => toggleSection("02")}
          >
            <div className="reader-width-options">
              <ReaderChoice
                value="normal"
                active={preferences.readingWidth === "normal"}
                label="Focused"
                onClick={() => set("readingWidth", "normal")}
                preview={
                  <span className="reader-width-preview reader-width-focused">
                    <i />
                  </span>
                }
              />

              <ReaderChoice
                value="wide"
                active={preferences.readingWidth === "wide"}
                label="Expanded"
                onClick={() => set("readingWidth", "wide")}
                preview={
                  <span className="reader-width-preview reader-width-expanded">
                    <i />
                  </span>
                }
              />
            </div>
          </ReaderSection>

          <ReaderSection
            eyebrow="03"
            title="Appearance"
            expanded={expandedSection === "03"}
            onToggle={() => toggleSection("03")}
          >
<div className="mb-5">
  <span className="reader-eyebrow">QUICK STYLES</span>
  <h3 className="iphone-settings-title mb-3">
    Choose your atmosphere
  </h3>

  <div className="reader-choice-grid">
    <ReaderChoice
      value="crispus"
      active={preferences.appearancePreset === "crispus"}
      label="Crispus"
      onClick={() => applyPreset("crispus")}
      preview={<span className="text-lg">✦</span>}
    />

    <ReaderChoice
      value="crystal"
      active={preferences.appearancePreset === "crystal"}
      label="Crystal"
      onClick={() => applyPreset("crystal")}
      preview={<span className="text-lg">◇</span>}
    />

    <ReaderChoice
      value="emerald"
      active={preferences.appearancePreset === "emerald"}
      label="Emerald"
      onClick={() => applyPreset("emerald")}
      preview={<span className="text-lg">◈</span>}
    />

    <ReaderChoice
      value="light"
      active={preferences.appearancePreset === "light"}
      label="Quiet Light"
      onClick={() => applyPreset("light")}
      preview={<span className="text-lg">☼</span>}
    />
  </div>
</div>
            <div className="iphone-display-settings">
              <div className="iphone-settings-heading">
                <div>
                  <span className="reader-eyebrow">
                    SURFACE STYLE
                  </span>

                  <h3 className="iphone-settings-title">
  Lens strength
</h3>
                </div>

                <span className="iphone-glass-value">
                  {glassPercentage}%
                </span>
              </div>

              <div className="iphone-glass-preview">
                <div className="iphone-preview-wallpaper">
                  <span />
                  <span />
                  <span />
                </div>

                <div
                  className="iphone-preview-lens"
                  
style={
  {
    "--preview-opacity": 0.035 + glassLevel * 0.12,
    "--preview-blur": `${2 + glassLevel * 10}px`,
    "--preview-saturation": `${120 + glassLevel * 60}%`,
  } as CSSProperties
}
                >
                  <div className="iphone-preview-content">
                    <span className="iphone-preview-dot" />
                    <span>Crystal interface</span>
                    <span
                      className="iphone-preview-arrow"
                      aria-hidden="true"
                    >
                      ↗
                    </span>
                  </div>
                </div>
              </div>

              <div className="iphone-slider-heading">
                <span>Subtle</span>
                <span>More pronounced</span>
              </div>

              <input
                className="iphone-glass-slider"
                type="range"
                min="0"
                max="100"
                step="1"
                value={glassPercentage}
                aria-label="Preview surface depth"
                aria-valuetext={`${glassPercentage}% surface depth`}
                onChange={(event) =>
                  onGlassLevelChange(Number(event.target.value) / 100)
                }
                style={
                  {
                    "--glass-progress": `${glassPercentage}%`,
                  } as CSSProperties
                }
              />

              <p className="iphone-slider-hint">
                Preview how a translucent surface looks against a
                layered background. Text remains crisp and readable.
              </p>
            </div>

            <div
              className="glass-theme-switcher"
              role="group"
              aria-label="Choose appearance"
            >
              <button
                type="button"
                className={`glass-theme-option ${
                  preferences.colorMode === "light" ? "is-selected" : ""
                }`}
                aria-pressed={preferences.colorMode === "light"}
                onClick={() => set("colorMode", "light")}
                title="Pearl theme"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
                </svg>
                <span>Pearl</span>
              </button>

              <button
                type="button"
                className={`glass-theme-option ${
                  preferences.colorMode === "dark" ? "is-selected" : ""
                }`}
                aria-pressed={preferences.colorMode === "dark"}
                onClick={() => set("colorMode", "dark")}
                title="Midnight theme"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" />
                </svg>
                <span>Midnight</span>
              </button>

              <button
                type="button"
                className={`glass-theme-option ${
                  preferences.colorMode === "sepia" ? "is-selected" : ""
                }`}
                aria-pressed={preferences.colorMode === "sepia"}
                onClick={() => set("colorMode", "sepia")}
                title="Sepia theme"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3v18m-7-11h14M6 6l12 12M18 6 6 18" />
                </svg>
                <span>Sepia</span>
              </button>
            </div>

            <div className="iphone-display-options">
              <div className="iphone-display-option">
                <span className="iphone-display-symbol" aria-hidden="true">
                
                </span>
                <div className="iphone-display-option-copy">
                  <strong>Display appearance</strong>
                  <span className="reader-accessibility-description">
                    Switch between Pearl, Midnight and Sepia.
                  </span>
                </div>
              </div>

              <div className="iphone-display-option">
                <span className="iphone-display-symbol" aria-hidden="true">
                  Aa
                </span>
                <div className="iphone-display-option-copy">
                  <strong>Text and readability</strong>
                  <span className="reader-accessibility-description">
                    Customize font size, spacing and reading width.
                  </span>
                </div>
              </div>

              <div className="iphone-display-option">
                <span className="iphone-display-symbol" aria-hidden="true">
                  ◈
                </span>
                <div className="iphone-display-option-copy">
                  <strong>Transparency preview</strong>
                  <span className="reader-accessibility-description">
                    Explore the visual depth of translucent surfaces.
                  </span>
                </div>
              </div>
            </div>
          </ReaderSection>

          <ReaderSection
            eyebrow="04"
            title="Accessibility" 
            expanded={expandedSection === "04"}
            onToggle={() => toggleSection("04")}
          >
            <div className="reader-accessibility-list">
              <ReaderToggle
                label="High contrast"
                description="Make text and borders clearer"
                checked={preferences.highContrast}
                onChange={(value) => set("highContrast", value)}
              />

              <ReaderToggle
                label="Reduce motion"
                description="Limit interface animations"
                checked={preferences.reduceMotion}
                onChange={(value) => set("reduceMotion", value)}
              />

              <ReaderToggle
                label="Reduce transparency"
                description="Use more solid surfaces"
                checked={preferences.reduceTransparency}
                onChange={(value) => set("reduceTransparency", value)}
              />

              <ReaderToggle
                label="Underline links"
                description="Make links easier to identify"
                checked={preferences.underlineLinks}
                onChange={(value) => set("underlineLinks", value)}
              />

              <ReaderToggle
                label="Focus mode"
                description="Hide supported decorative elements"
                checked={preferences.focusMode}
                onChange={(value) => set("focusMode", value)}
              />
            </div>
          </ReaderSection>
        </div>
<ReaderSection
  eyebrow="05"
  title="Liquid Glass"
  expanded={expandedSection === "05"}
  onToggle={() => toggleSection("05")}
>
  <StudioSlider
    label="Frostiness"
    description="Control the blur, from clear glass to a frosted surface."
    value={preferences.frostLevel}
    onChange={(value) => set("frostLevel", value)}
    leftLabel="Clear"
    rightLabel="Frosted"
  />

  <StudioSlider
    label="Transparency"
    description="Choose how much of the background shows through."
    value={preferences.transparency}
    onChange={(value) => set("transparency", value)}
    leftLabel="Solid"
    rightLabel="Transparent"
  />

  <StudioSlider
    label="Reflections"
    description="Adjust the intensity of glossy highlights."
    value={preferences.reflectionLevel}
    onChange={(value) => set("reflectionLevel", value)}
    leftLabel="Subtle"
    rightLabel="Glossy"
  />

  <StudioSlider
    label="Glass depth"
    description="Adjust the visual depth and shadow of glass surfaces."
    value={preferences.glassDepth}
    onChange={(value) => set("glassDepth", value)}
    leftLabel="Flat"
    rightLabel="Deep"
  />
</ReaderSection>



        <div className="reader-console-footer">
          <span>Preferences are saved automatically</span>
          <button
            type="button"
            onClick={resetPreferences}
            className="reader-reset"
          >
            Reset preferences
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function NavbarLensCTA() {
  return (
    <Link href="/signup" className="navbar-cta">
      <span>Create Your Portfolio</span>
      <span className="navbar-cta-arrow" aria-hidden="true">
        ↗
      </span>
    </Link>
  );
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const { preferences, updatePreference } = useReader();


const glassLevel = preferences.glassLevel;

const setGlassLevel = (value: number) => {
  updatePreference("glassLevel", Math.min(1, Math.max(0, value)));
};

const glassStyle = {
  "--navbar-glass-blur": `${Math.round(8 + glassLevel * 32)}px`,
  "--navbar-glass-tint": 0.035 + glassLevel * 0.16,
  "--navbar-glass-saturation": `${120 + glassLevel * 60}%`,
  "--site-glass-level": glassLevel,
} as CSSProperties;

useEffect(() => {
  if (!open) {
    document.body.style.overflow = "";
    return;
  }

  document.body.style.overflow = "hidden";

  return () => {
    document.body.style.overflow = "";
  };
}, [open]);
  
  useEffect(() => {
  if (!readerOpen) return;

  const handleOutsidePointer = (event: PointerEvent) => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const panel = document.querySelector(".reader-console");
    const toggle = target.closest(
      '[aria-label="Open reader tools"], [aria-label="Reader tools"]'
    );

    if (panel?.contains(target) || toggle) return;

    setReaderOpen(false);
  };

  document.addEventListener("pointerdown", handleOutsidePointer);

  return () => {
    document.removeEventListener("pointerdown", handleOutsidePointer);
  };
}, [readerOpen]);

  const closeMenus = () => {
    setOpen(false);
    setReaderOpen(false);
  };

  return (
    <header
      className={[
        "fixed left-0 right-0 top-0 z-50 px-4 pt-4",
        open || readerOpen ? "navbar-open-state" : "",
      ].join(" ")}
    >
      <div
  className="navbar-liquid-glass"
  style={glassStyle}
>
        <nav className="mx-auto w-full max-w-7xl overflow-visible">
  <LensGlass
    className={[
      "navbar-glass w-full",
      open || readerOpen ? "navbar-glass-expanded" : "",
    ].join(" ")}
    radius={22}
    optics={{
  strength: 0.02 + glassLevel * 0.18,
  depth: 0.25 + glassLevel * 0.55,
  curvature: 0.15 + glassLevel * 0.35,
  dispersion: 0.01 + glassLevel * 0.05,
  bend: 0.08 + glassLevel * 0.35,
  frost: 0,
}}
    style={{
      background: `color-mix(
        in srgb,
        var(--surface) ${
          (0.035 + glassLevel * 0.16) * 100
        }%,
        transparent
      )`,
      border: "1px solid var(--liquid-edge, var(--border))",
      boxShadow:
        "inset 0 1px 0 var(--liquid-highlight, rgba(255,255,255,0.12)), 0 12px 36px rgba(0,0,0,0.12)",
    }}
  >
          <div className="relative flex h-[68px] items-center justify-between gap-4">
            <Link
              href="/"
              onClick={closeMenus}
              className="group relative z-10 shrink-0 text-xl font-semibold tracking-tight"
            >
              Crispus
              <span className="text-[#126BFF] transition-colors duration-300 group-hover:text-[#D9A441]">
                .
              </span>
            </Link>

            <div className="hidden items-center gap-3 lg:flex">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="navbar-link"
                >
                  {link.label}
                </Link>
              ))}

              <button
                type="button"
                onClick={() => {
                  setReaderOpen((current) => !current);
                  setOpen(false);
                }}
                className={`navbar-tool-button ${
                  readerOpen ? "navbar-tool-button-active" : ""
                }`}
                aria-label="Open reader tools"
                aria-expanded={readerOpen}
              >
                <span>Aa</span>
              </button>

              <Link href="/login" className="navbar-login">
                Log in
              </Link>

              <NavbarLensCTA />
            </div>

            <div className="flex shrink-0 items-center gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => {
                  setReaderOpen((current) => !current);
                  setOpen(false);
                }}
                className={`navbar-tool-button ${
                  readerOpen ? "navbar-tool-button-active" : ""
                }`}
                aria-label="Reader tools"
                aria-expanded={readerOpen}
              >
                Aa
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpen((current) => !current);
                  setReaderOpen(false);
                }}
                className={`navbar-menu-button ${
                  open ? "navbar-menu-button-active" : ""
                }`}
                aria-label="Toggle navigation"
                aria-expanded={open}
              >
                <span
                  className={`navbar-menu-line ${
                    open ? "navbar-menu-line-top" : ""
                  }`}
                />
                <span
                  className={`navbar-menu-line ${
                    open ? "navbar-menu-line-bottom" : ""
                  }`}
                />
              </button>
            </div>
          </div>
  </LensGlass>
          {open && (
            <div className="navbar-waterfall">
              <div className="navbar-waterfall-scroll">
                <div className="navbar-waterfall-inner">
                  <div className="navbar-waterfall-label">
                    <span>Navigate</span>
                    <span className="navbar-waterfall-line" />
                  </div>

                  {links.map((link, index) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="navbar-waterfall-item"
                      style={
                        {
                          "--waterfall-index": index,
                        } as CSSProperties
                      }
                    >
                      <span className="navbar-waterfall-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="navbar-waterfall-title">
                        {link.label}
                      </span>
                      <span
                        className="navbar-waterfall-arrow"
                        aria-hidden="true"
                      >
                        ↗
                      </span>
                    </Link>
                  ))}

                  <div className="navbar-waterfall-divider" />

                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="navbar-waterfall-secondary"
                  >
                    Log in
                  </Link>

                  <Link
                    href="/signup"
                    onClick={() => setOpen(false)}
                    className="navbar-waterfall-consultation"
                  >
                    <span>Create Your Portfolio</span>
                    <span aria-hidden="true">↗</span>
                  </Link>
                </div>
              </div>
            </div>
          )}

          
<AnimatePresence initial={false} mode="sync">
  {readerOpen && (
    <motion.div
      key="display-studio"
      initial={{
        opacity: 0,
        y: 18,
        scale: 0.96,
        filter: "blur(8px)",
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
      }}
      exit={{
        opacity: 0,
        y: 12,
        scale: 0.97,
        filter: "blur(6px)",
      }}
      transition={{
        type: "spring",
        stiffness: 340,
        damping: 28,
        mass: 0.8,
      }}
      style={{ transformOrigin: "top right" }}
    >
      <ReaderConsole
        onClose={() => setReaderOpen(false)}
        glassLevel={glassLevel}
        onGlassLevelChange={setGlassLevel}
      />
    </motion.div>
  )}
</AnimatePresence>


        </nav>
      </div>
    </header>
  );
}