
"use client";

import Link from "next/link";
import type {
  CSSProperties,
  KeyboardEvent,
  ReactNode,
} from "react";

import type { WelcomePageContent } from "@/lib/welcome-page";
import { Navbar } from "@/components/navigation/Navbar";
import { LensGlass } from "@/components/ui/LensGlass";

type Props = {
  content: WelcomePageContent;
  preview?: boolean;
  onSelectSection?: (section: string) => void;
};


function LensPanel({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <LensGlass
      className={className}
      radius={24}
      style={{
        background: "var(--lens-tint, rgba(255,255,255,0.025))",
        border: "1px solid var(--liquid-edge, rgba(255,255,255,0.18))",
        boxShadow:
          "inset 0 1px 0 var(--liquid-highlight, rgba(255,255,255,0.12)), 0 12px 36px rgba(0,0,0,0.10)",
        ...style,
      }}
    >
      {children}
    </LensGlass>
  );
}


function LensButton({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`site-glass inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-white/20 px-7 py-4 text-sm font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-white/10 ${className}`}
    >
      {children}
    </span>
  );
}

export default function WelcomePageView({
  content,
  preview = false,
  onSelectSection,
}: Props) {
  const {
    hero,
    features,
    audiences,
    steps,
    cta,
    footer,
    appearance,
  } = content;

  const accent = appearance?.accentColor || "#6366F1";
  const background = appearance?.backgroundColor || "#05070D";

  const heroBackground = String(
    (hero as unknown as Record<string, unknown>).backgroundImage ?? ""
  ).trim();

  const isVideo = /\.(mp4|webm|mov)(?:[?#].*)?$/i.test(
    heroBackground
  );

  const jump = (section: string) => {
    onSelectSection?.(section);
  };

  const sectionProps = (section: string) =>
    preview
      ? {
          role: "button" as const,
          tabIndex: 0,
          onClick: () => jump(section),
          onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              jump(section);
            }
          },
        }
      : {};

  const pageStyle: CSSProperties = {
    position: "relative",
    minHeight: "100vh",
    backgroundColor: heroBackground ? "transparent" : background,
  };

  const primaryButtonStyle: CSSProperties = {
    background: `linear-gradient(135deg, ${accent}, ${accent}CC)`,
    boxShadow: `0 8px 24px ${accent}30`,
  };

  return (
    <main
      className="relative isolate min-h-screen overflow-x-clip text-white"
      style={pageStyle}
    >
      {heroBackground && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
          style={{ backgroundColor: background }}
        >
          {isVideo ? (
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="absolute inset-0 h-full w-full object-cover"
            >
              <source src={heroBackground} />
            </video>
          ) : (
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: `url("${heroBackground.replace(/["\\]/g, "")}")`,
              }}
            />
          )}

          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(5,7,13,0.18), rgba(5,7,13,0.48))",
            }}
          />
        </div>
      )}

      <div className="relative z-10">
        <div className="relative z-50">
          <Navbar />
        </div>

        {/* HERO */}
        <section
          {...sectionProps("hero")}
          className="relative isolate px-6 pb-24 pt-20 sm:px-10 sm:pt-28 lg:px-16 lg:pb-32 lg:pt-36"
        >
          <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <LensPanel className="mb-8 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-white/90">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                {hero.badge}
              </LensPanel>

              <h1 className="max-w-4xl whitespace-pre-line text-5xl font-semibold leading-[1.06] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
                {hero.title}
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage: `linear-gradient(105deg, ${accent}, #7DD3FC 55%, #C4B5FD)`,
                  }}
                >
                  {hero.highlight}
                </span>
              </h1>

              <p className="mt-8 max-w-xl text-lg leading-8 text-white/85 sm:text-xl">
                {hero.description}
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  href={hero.primaryLink || "/signup"}
                  className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-white/20 px-7 py-4 text-sm font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  style={primaryButtonStyle}
                >
                  {hero.primaryButton}
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </Link>

                <Link
                  href={hero.secondaryLink || "/login"}
                  className="inline-flex"
                >
                  <LensButton>{hero.secondaryButton}</LensButton>
                </Link>
              </div>

              <p className="mt-5 text-sm text-white/75">
                {hero.note}
              </p>
            </div>

            {/* PORTFOLIO PREVIEW */}
            <div className="relative mx-auto w-full max-w-xl">
              <LensPanel className="rounded-[32px] p-3 sm:p-5">
                <div className="relative rounded-[25px] border border-white/15 bg-black/10 p-6 sm:p-8">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2" aria-hidden="true">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                    </div>

                    <span className="text-xs tracking-wide text-white/70">
                      YOUR PORTFOLIO
                    </span>
                  </div>

                  <div className="mt-9 flex items-center gap-4">
                    <div
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/20 text-xl font-semibold"
                      style={{
                        background: `linear-gradient(135deg, ${accent}90, #8B5CF640)`,
                      }}
                    >
                      Y
                    </div>

                    <div>
                      <p className="text-xl font-semibold tracking-tight">
                        Your Name
                      </p>
                      <p className="mt-1 text-sm text-white/75">
                        Your professional title
                      </p>
                      <p className="mt-2 text-xs text-emerald-300">
                        ● Your story, your way
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 border-t border-white/15 pt-6">
                    <p
                      className="text-xs font-medium uppercase tracking-[0.2em]"
                      style={{ color: accent }}
                    >
                      About
                    </p>

                    <p className="mt-3 text-sm leading-7 text-white/80">
                      Introduce yourself, explain what you do and share the
                      experience and ideas that make your work yours.
                    </p>
                  </div>

                  <div className="mt-7 grid grid-cols-2 gap-3">
                    {["YOUR SKILLS", "YOUR PROJECTS"].map(
                      (label, index) => (
                        <div
                          key={label}
                          className="rounded-2xl border border-white/15 bg-white/[0.025] p-4"
                        >
                          <span className="text-xs text-white/75">
                            {label}
                          </span>

                          <div className="mt-4 flex gap-2">
                            <div
                              className="h-10 flex-1 rounded-xl"
                              style={{
                                background: `linear-gradient(135deg, ${accent}90, ${accent}15)`,
                              }}
                            />
                            <div className="h-10 flex-1 rounded-xl border border-white/15" />
                          </div>

                          {index === 0 && (
                            <div className="mt-2 h-2 w-3/4 rounded-full border border-white/20" />
                          )}
                        </div>
                      )
                    )}
                  </div>

                  <LensPanel className="mt-4 flex items-center justify-between rounded-2xl px-4 py-4">
                    <div>
                      <p className="text-sm font-medium">
                        Your portfolio link
                      </p>
                      <p className="mt-1 text-xs text-white/70">
                        A place to share your work
                      </p>
                    </div>

                    <span
                      aria-hidden="true"
                      className="text-xl"
                      style={{ color: accent }}
                    >
                      ↗
                    </span>
                  </LensPanel>
                </div>
              </LensPanel>

              <LensPanel className="absolute -bottom-5 -left-3 rounded-2xl px-4 py-3 sm:-left-8">
                <p className="text-xs text-white/75">
                  Built around you
                </p>
                <p className="mt-1 text-sm font-medium">
                  Skills · Projects · Experience
                </p>
              </LensPanel>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section
          {...sectionProps("features")}
          className="relative border-y border-white/10 px-6 py-20 sm:px-10 lg:px-16 lg:py-24"
        >
          <div className="mx-auto max-w-7xl">
            <p
              className="text-xs font-semibold uppercase tracking-[0.25em]"
              style={{ color: accent }}
            >
              {features.eyebrow}
            </p>

            <div className="mt-5 grid gap-8 lg:grid-cols-2 lg:gap-16">
              <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                {features.title}
              </h2>

              <p className="max-w-2xl text-base leading-8 text-white/80 sm:text-lg">
                {features.description}
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {features.cards.map((card, index) => (
                <LensPanel
                  key={`${card.title}-${index}`}
                  className="group rounded-3xl p-7 transition duration-300 hover:-translate-y-1 hover:bg-white/[0.07]"
                >
                  <span
                    className="relative text-2xl"
                    style={{ color: accent }}
                  >
                    {["✦", "◇", "◎"][index % 3]}
                  </span>

                  <h3 className="relative mt-6 text-xl font-semibold">
                    {card.title}
                  </h3>

                  <p className="relative mt-3 text-sm leading-7 text-white/80">
                    {card.description}
                  </p>
                </LensPanel>
              ))}
            </div>
          </div>
        </section>

        {/* AUDIENCES */}
        <section
          {...sectionProps("audiences")}
          className="relative px-6 py-20 sm:px-10 lg:px-16 lg:py-28"
        >
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p
                className="text-xs font-semibold uppercase tracking-[0.25em]"
                style={{ color: accent }}
              >
                {audiences.eyebrow}
              </p>

              <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
                {audiences.title}
              </h2>

              <p className="mt-5 text-base leading-8 text-white/80">
                {audiences.description}
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {audiences.cards.map((card, index) => (
                <LensPanel
                  key={`${card.title}-${index}`}
                  className="group rounded-3xl p-7 transition duration-300 hover:-translate-y-1 hover:bg-white/[0.07] sm:p-9"
                >
                  <span
                    className="relative text-sm font-medium"
                    style={{ color: accent }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <h3 className="relative mt-5 text-xl font-semibold sm:text-2xl">
                    {card.title}
                  </h3>

                  <p className="relative mt-3 max-w-lg text-sm leading-7 text-white/80">
                    {card.description}
                  </p>
                </LensPanel>
              ))}
            </div>
          </div>
        </section>

        {/* STEPS */}
        <section
          {...sectionProps("steps")}
          className="relative border-y border-white/10 px-6 py-20 sm:px-10 lg:px-16 lg:py-24"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <p
                className="text-xs font-semibold uppercase tracking-[0.25em]"
                style={{ color: accent }}
              >
                {steps.eyebrow}
              </p>

              <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
                {steps.title}
              </h2>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {steps.cards.map((step, index) => (
                <LensPanel
                  key={`${step.title}-${index}`}
                  className="rounded-3xl p-7 transition duration-300 hover:bg-white/[0.07] sm:p-8"
                >
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border text-sm font-semibold"
                    style={{
                      borderColor: `${accent}90`,
                      color: accent,
                    }}
                  >
                    {step.number || String(index + 1).padStart(2, "0")}
                  </span>

                  <h3 className="mt-6 text-xl font-semibold">
                    {step.title}
                  </h3>

                  <p className="mt-3 text-sm leading-7 text-white/80">
                    {step.description}
                  </p>
                </LensPanel>
              ))}
            </div>
          </div>
        </section>

        {/* CALL TO ACTION */}
        <section
          {...sectionProps("cta")}
          className="relative px-6 py-24 sm:px-10 lg:px-16 lg:py-32"
        >
          <LensPanel className="mx-auto max-w-5xl rounded-[36px] px-7 py-14 text-center sm:px-14 sm:py-20">
            <p
              className="text-xs font-semibold uppercase tracking-[0.25em]"
              style={{ color: accent }}
            >
              {cta.eyebrow}
            </p>

            <h2 className="mx-auto mt-5 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
              {cta.title}
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-white/80">
              {cta.description}
            </p>

            <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                href={cta.primaryLink || "/signup"}
                className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-white/20 px-7 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-110"
                style={primaryButtonStyle}
              >
                {cta.primaryButton}
              </Link>

              <Link
                href={cta.secondaryLink || "/login"}
                className="inline-flex"
              >
                <LensButton>{cta.secondaryButton}</LensButton>
              </Link>
            </div>
          </LensPanel>
        </section>

        {/* FOOTER */}
        <footer
          {...sectionProps("footer")}
          className="relative border-t border-white/10 px-6 py-8 sm:px-10 lg:px-16"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight"
            >
              Crispus<span style={{ color: accent }}>.</span>
            </Link>

            <p className="text-sm text-white/75">
              {footer.description}
            </p>

            <div className="flex gap-5 text-sm text-white/75">
              <Link
                className="transition hover:text-white"
                href="/about"
              >
                About
              </Link>

              <Link
                className="transition hover:text-white"
                href="/login"
              >
                Log in
              </Link>

              <Link
                className="transition hover:text-white"
                href="/signup"
              >
                Sign up
              </Link>
            </div>

            <p className="text-xs text-white/60">
              {footer.copyright}
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}