
"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { Glass } from "@samasante/liquid-glass";

type LiquidLensSurfaceProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  children: ReactNode;
  radius?: number;
  intensity?: "subtle" | "medium" | "strong";
};

type GlassSettings = {
  glass: number;
  frost: number;
  transparency: number;
  reflection: number;
  depth: number;
};

type GlassIntensity = NonNullable<LiquidLensSurfaceProps["intensity"]>;

const DEFAULT_SETTINGS: GlassSettings = {
  glass: 0.72,
  frost: 0,
  transparency: 0.72,
  reflection: 0.65,
  depth: 0.65,
};

const INTENSITY_OPACITY: Record<GlassIntensity, number> = {
  subtle: 0.65,
  medium: 0.85,
  strong: 1,
};

const clamp = (value: number): number =>
  Math.min(1, Math.max(0, value));

function readGlassSettings(): GlassSettings {
  const styles = getComputedStyle(document.documentElement);

  const read = (name: string, fallback: number): number => {
    const value = Number.parseFloat(styles.getPropertyValue(name));

    return Number.isFinite(value) ? clamp(value) : fallback;
  };

  return {
    glass: read("--site-glass-level", DEFAULT_SETTINGS.glass),
    frost: read("--site-glass-frost", DEFAULT_SETTINGS.frost),
    transparency: read(
      "--site-glass-transparency",
      DEFAULT_SETTINGS.transparency,
    ),
    reflection: read(
      "--site-glass-reflection",
      DEFAULT_SETTINGS.reflection,
    ),
    depth: read("--site-glass-depth", DEFAULT_SETTINGS.depth),
  };
}

function readReducedTransparency(): boolean {
  return (
    document.documentElement.dataset.reduceTransparency === "true"
  );
}

export function LiquidLensSurface({
  children,
  className = "",
  style,
  radius = 24,
  intensity = "medium",
  ...props
}: LiquidLensSurfaceProps) {
  const [settings, setSettings] =
    useState<GlassSettings>(DEFAULT_SETTINGS);

  const [reducedTransparency, setReducedTransparency] =
    useState(false);

  useEffect(() => {
    const root = document.documentElement;

    const updateSettings = () => {
      setSettings(readGlassSettings());
      setReducedTransparency(readReducedTransparency());
    };

    updateSettings();

    const observer = new MutationObserver(updateSettings);

    observer.observe(root, {
      attributes: true,
      attributeFilter: [
        "style",
        "class",
        "data-reduce-transparency",
      ],
    });

    return () => observer.disconnect();
  }, []);

  const intensityOpacity = INTENSITY_OPACITY[intensity];

  const transparencyFactor = reducedTransparency ? 0.25 : 1;
  const reflectionFactor = reducedTransparency ? 0.3 : 1;

  const optics = {
    strength:
      (0.04 + settings.glass * 0.18) *
      intensityOpacity *
      transparencyFactor,

    depth: 0.3 + settings.depth * 0.7,

    curvature: 0.35 + settings.depth * 0.3,

    dispersion:
      (0.03 + settings.reflection * 0.12) *
      intensityOpacity *
      reflectionFactor,

    bend: 0.2 + settings.depth * 0.35,

    bendWidth: 0.04 + settings.reflection * 0.05,

    specular:
      (0.25 + settings.reflection * 0.95) *
      intensityOpacity *
      reflectionFactor,

    sheen:
      (0.15 + settings.reflection * 0.75) *
      intensityOpacity *
      reflectionFactor,

    sheenWidth: 2.5,

    sheenFalloff: 1.5,

    sheenAngle: 45,

    frost: reducedTransparency ? 0 : settings.frost * 0.8,

    brightness: 0,

    glow:
      (0.03 + settings.reflection * 0.1) *
      intensityOpacity *
      reflectionFactor,

    glowSpread: 1,

    glowFalloff: 0.8,
  };

  const surfaceStyle: CSSProperties = {
    position: "relative",
    display: "block",
    width: "100%",
    borderRadius: `${Math.max(0, radius)}px`,
    ...style,
  };

  return (
    <Glass
      {...props}
      data-crispus-liquid-lens="true"
      data-glass-intensity={intensity}
      data-reduce-transparency={
        reducedTransparency ? "true" : undefined
      }
      className={`crispus-live-liquid-surface ${className}`.trim()}
      optics={optics}
      style={surfaceStyle}
    >
      {children}
    </Glass>
  );
}