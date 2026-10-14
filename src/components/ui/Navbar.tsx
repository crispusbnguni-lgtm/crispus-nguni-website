"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  useReader,
  type ReaderPreferences,
} from "@/components/ui/ReaderProvider";

const links = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Learn", href: "/learn" },
  { label: "Solutions", href: "/solutions" },
  { label: "Markets", href: "/markets" },
  { label: "Insights", href: "/insights" },
];

const textScaleLabels: Record<number, string> = {
  0.9: "90%",
  1: "100%",
  1.1: "110%",
  1.2: "120%",
  1.3: "130%",
};

function OptionButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "reader-option",
        active ? "reader-option-active" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Toggle({
  enabled,
  onClick,
}: {
  enabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onClick}
      className={[
        "reader-toggle",
        enabled ? "reader-toggle-active" : "",
      ].join(" ")}
    >
      <span className="reader-toggle-knob" />
    </button>
  );
}

function ReaderTools() {
  const {
    preferences,
    updatePreference,
    resetPreferences,
  } = useReader();

  const set = <
    K extends keyof ReaderPreferences,
  >(
    key: K,
    value: ReaderPreferences[K]
  ) => {
    updatePreference(key, value);
  };

  return (
    <div className="navbar-reader-surface">
      <div className="navbar-reader-heading">
        <div>
          <span className="navbar-reader-kicker">
            Reader
          </span>

          <h2>Reading preferences</h2>
        </div>

        <div className="reader-live-indicator">
          <span />
          Live
        </div>
      </div>

      <p className="navbar-reader-description">
        Shape the reading experience around your eyes,
        your focus and your preferred way of learning.
      </p>

      <div className="reader-tools-grid">
        <section className="reader-control-block reader-control-wide">
          <div className="reader-control-header">
            <div>
              <span className="reader-control-label">
                Text size
              </span>

              <span className="reader-control-value">
                {textScaleLabels[preferences.textScale] ??
                  `${Math.round(
                    preferences.textScale * 100
                  )}%`}
              </span>
            </div>
          </div>

          <div
            className="reader-segmented"
            aria-label="Text size"
          >
            {[0.9, 1, 1.1, 1.2, 1.3].map(
              (scale) => (
                <OptionButton
                  key={scale}
                  active={
                    preferences.textScale === scale
                  }
                  onClick={() =>
                    set("textScale", scale)
                  }
                >
                  {textScaleLabels[scale]}
                </OptionButton>
              )
            )}
          </div>
        </section>

        <section className="reader-control-block">
          <span className="reader-control-label">
            Reading width
          </span>

          <div className="reader-segmented">
            <OptionButton
              active={
                preferences.readingWidth === "normal"
              }
              onClick={() =>
                set("readingWidth", "normal")
              }
            >
              Standard
            </OptionButton>

            <OptionButton
              active={
                preferences.readingWidth === "wide"
              }
              onClick={() =>
                set("readingWidth", "wide")
              }
            >
              Wide
            </OptionButton>
          </div>
        </section>

        <section className="reader-control-block">
          <span className="reader-control-label">
            Typeface
          </span>

          <div className="reader-segmented">
            <OptionButton
              active={
                preferences.fontFamily === "system"
              }
              onClick={() =>
                set("fontFamily", "system")
              }
            >
              Sans
            </OptionButton>

            <OptionButton
              active={
                preferences.fontFamily === "serif"
              }
              onClick={() =>
                set("fontFamily", "serif")
              }
            >
              Serif
            </OptionButton>

            <OptionButton
              active={
                preferences.fontFamily === "mono"
              }
              onClick={() =>
                set("fontFamily", "mono")
              }
            >
              Mono
            </OptionButton>
          </div>
        </section>

        <section className="reader-control-block">
          <span className="reader-control-label">
            Line spacing
          </span>

          <div className="reader-segmented">
            {(
              [
                ["normal", "Compact"],
                ["relaxed", "Relaxed"],
                ["loose", "Loose"],
              ] as const
            ).map(([value, label]) => (
              <OptionButton
                key={value}
                active={
                  preferences.lineHeight === value
                }
                onClick={() =>
                  set("lineHeight", value)
                }
              >
                {label}
              </OptionButton>
            ))}
          </div>
        </section>

        <section className="reader-control-block">
          <span className="reader-control-label">
            Letter spacing
          </span>

          <div className="reader-segmented">
            {(
              [
                ["normal", "Normal"],
                ["wide", "Wide"],
                ["wider", "Wider"],
              ] as const
            ).map(([value, label]) => (
              <OptionButton
                key={value}
                active={
                  preferences.letterSpacing === value
                }
                onClick={() =>
                  set("letterSpacing", value)
                }
              >
                {label}
              </OptionButton>
            ))}
          </div>
        </section>

        <section className="reader-control-block">
          <span className="reader-control-label">
            Appearance
          </span>

          <div className="reader-segmented">
            {(
              [
                ["dark", "Dark"],
                ["light", "Light"],
                ["sepia", "Sepia"],
              ] as const
            ).map(([value, label]) => (
              <OptionButton
                key={value}
                active={
                  preferences.colorMode === value
                }
                onClick={() =>
                  set("colorMode", value)
                }
              >
                {label}
              </OptionButton>
            ))}
          </div>
        </section>
      </div>

      <div className="reader-divider" />

      <div className="reader-accessibility">
        <div className="reader-accessibility-heading">
          <span className="reader-control-label">
            Accessibility
          </span>

          <span className="reader-accessibility-note">
            Personal controls
          </span>
        </div>

        <div className="reader-toggle-list">
          <div className="reader-toggle-row">
            <div>
              <span className="reader-toggle-title">
                High contrast
              </span>

              <span className="reader-toggle-description">
                Increase visual separation between content.
              </span>
            </div>

            <Toggle
              enabled={preferences.highContrast}
              onClick={() =>
                set(
                  "highContrast",
                  !preferences.highContrast
                )
              }
            />
          </div>

          <div className="reader-toggle-row">
            <div>
              <span className="reader-toggle-title">
                Reduce motion
              </span>

              <span className="reader-toggle-description">
                Keep transitions calm and minimal.
              </span>
            </div>

            <Toggle
              enabled={preferences.reduceMotion}
              onClick={() =>
                set(
                  "reduceMotion",
                  !preferences.reduceMotion
                )
              }
            />
          </div>

          <div className="reader-toggle-row">
            <div>
              <span className="reader-toggle-title">
                Reduce transparency
              </span>

              <span className="reader-toggle-description">
                Make layered surfaces more solid.
              </span>
            </div>

            <Toggle
              enabled={preferences.reduceTransparency}
              onClick={() =>
                set(
                  "reduceTransparency",
                  !preferences.reduceTransparency
                )
              }
            />
          </div>

          <div className="reader-toggle-row">
            <div>
              <span className="reader-toggle-title">
                Underline links
              </span>

              <span className="reader-toggle-description">
                Make interactive links easier to identify.
              </span>
            </div>

            <Toggle
              enabled={preferences.underlineLinks}
              onClick={() =>
                set(
                  "underlineLinks",
                  !preferences.underlineLinks
                )
              }
            />
          </div>

          <div className="reader-toggle-row">
            <div>
              <span className="reader-toggle-title">
                Focus mode
              </span>

              <span className="reader-toggle-description">
                Reduce visual distractions while reading.
              </span>
            </div>

            <Toggle
              enabled={preferences.focusMode}
              onClick={() =>
                set(
                  "focusMode",
                  !preferences.focusMode
                )
              }
            />
          </div>
        </div>
      </div>

      <div className="reader-footer">
        <span>
          Preferences are saved automatically.
        </span>

        <button
          type="button"
          onClick={resetPreferences}
          className="reader-reset"
        >
          Reset preferences
        </button>
      </div>
    </div>
  );
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [readerOpen, setReaderOpen] =
    useState(false);

  useEffect(() => {
    if (!open && !readerOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [open, readerOpen]);

  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-4 pt-4">
      <nav
        className={[
          "navbar-glass mx-auto max-w-7xl overflow-hidden",
          open || readerOpen
            ? "navbar-glass-expanded"
            : "",
        ].join(" ")}
      >
        <div className="relative flex h-[68px] items-center justify-between px-5">
          <Link
            href="/"
            onClick={() => {
              setOpen(false);
              setReaderOpen(false);
            }}
            className="group relative z-10 text-xl font-semibold tracking-tight"
          >
            Crispus
            <span className="text-[#126BFF] transition-all duration-300 group-hover:text-[#D9A441]">
              .
            </span>
          </Link>

          <div className="hidden items-center gap-2 lg:flex">
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
                setReaderOpen(!readerOpen);
                setOpen(false);
              }}
              className={[
                "navbar-tool-button",
                readerOpen
                  ? "navbar-tool-button-active"
                  : "",
              ].join(" ")}
              aria-label="Open reader tools"
              aria-expanded={readerOpen}
            >
              Aa
            </button>

            <Link
              href="/login"
              className="navbar-login"
            >
              Login
            </Link>

            <Link
              href="/consultation"
              className="navbar-cta"
            >
              <span>Book Consultation</span>
              <span className="navbar-cta-arrow">
                 
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => {
                setReaderOpen(!readerOpen);
                setOpen(false);
              }}
              className={[
                "navbar-tool-button",
                readerOpen
                  ? "navbar-tool-button-active"
                  : "",
              ].join(" ")}
              aria-label="Reader tools"
              aria-expanded={readerOpen}
            >
              Aa
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(!open);
                setReaderOpen(false);
              }}
              className={[
                "navbar-menu-button",
                open
                  ? "navbar-menu-button-active"
                  : "",
              ].join(" ")}
              aria-label="Toggle navigation"
              aria-expanded={open}
            >
              <span
                className={[
                  "navbar-menu-line",
                  open
                    ? "navbar-menu-line-top"
                    : "",
                ].join(" ")}
              />

              <span
                className={[
                  "navbar-menu-line",
                  open
                    ? "navbar-menu-line-bottom"
                    : "",
                ].join(" ")}
              />
            </button>
          </div>
        </div>

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
                      } as React.CSSProperties
                    }
                  >
                    <span className="navbar-waterfall-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <span className="navbar-waterfall-title">
                      {link.label}
                    </span>

                    <span className="navbar-waterfall-arrow">
                       
                    </span>
                  </Link>
                ))}

                <div className="navbar-waterfall-divider" />

                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="navbar-waterfall-secondary"
                >
                  Login
                </Link>

                <Link
                  href="/consultation"
                  onClick={() => setOpen(false)}
                  className="navbar-waterfall-consultation"
                >
                  <span>Book Consultation</span>
                  <span> </span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {readerOpen && <ReaderTools />}
      </nav>
    </header>
  );
}