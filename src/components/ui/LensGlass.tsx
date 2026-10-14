
"use client";

import type { CSSProperties, ReactNode } from "react";
import { Glass, type GlassOptics } from "@samasante/liquid-glass";
import { useReader } from "@/components/ui/ReaderProvider";

type LensGlassProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  radius?: number | string;
  optics?: Partial<GlassOptics>;
};

export const LENS_OPTICS: GlassOptics = {
  mapSize: 256,
  clipToShape: true,
  softEdge: true,
  sheenDark: true,
  splay: 0.02,

  strength: 0.12,
  depth: 0.82,
  curvature: 0.38,
  dispersion: 0.045,
  bend: 0.32,
  bendWidth: 0.055,

  specular: 0.75,
  sheen: 0.28,
  sheenWidth: 2,
  sheenFalloff: 1.5,
  sheenAngle: 45,

  frost: 0,
  brightness: 0,
  glow: 0.035,
  glowSpread: 1,
  glowFalloff: 0.8,
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function LensGlass({
  children,
  className = "",
  style,
  radius = 24,
  optics,
}: LensGlassProps) {
  const { preferences } = useReader();

  const strengthLevel = clamp(preferences.glassLevel);
  const frostLevel = clamp(preferences.frostLevel);
  const transparencyLevel = clamp(preferences.transparency);
  const reflectionLevel = clamp(preferences.reflectionLevel);
  const depthLevel = clamp(preferences.glassDepth);

  const dynamicOptics: Partial<GlassOptics> = {
    ...LENS_OPTICS,

    // Liquid lens refraction
    strength: 0.025 + strengthLevel * 0.135,
    depth: 0.2 + depthLevel * 0.8,
    curvature: 0.08 + strengthLevel * 0.42,
    dispersion: 0.005 + strengthLevel * 0.04,
    bend: 0.04 + strengthLevel * 0.42,
    bendWidth: 0.035 + strengthLevel * 0.045,

    // Independent frostiness
    frost: frostLevel * 5,

    // Reflections
    specular: 0.2 + reflectionLevel * 0.8,
    sheen: 0.08 + reflectionLevel * 0.42,

    // Preserve subtle illumination
    brightness: 0,
    glow: 0.01 + reflectionLevel * 0.04,

    // Respect explicit per-component overrides
    ...optics,
  };

  const effectiveTransparency = preferences.reduceTransparency
    ? Math.min(transparencyLevel, 0.35)
    : transparencyLevel;

  const tintOpacity = 0.025 + (1 - effectiveTransparency) * 0.2;
  const edgeOpacity = 0.1 + reflectionLevel * 0.35;
  const highlightOpacity = 0.06 + reflectionLevel * 0.24;
  const shadowOpacity = 0.04 + depthLevel * 0.12;

  return (
    <Glass
      className={className}
      optics={dynamicOptics}
      radius={typeof radius === "number" ? radius : undefined}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: radius,
        background: `rgba(255,255,255,${tintOpacity})`,
        border: `1px solid rgba(255,255,255,${edgeOpacity})`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,${highlightOpacity}), 0 12px 36px rgba(0,0,0,${shadowOpacity})`,
        ...style,
      }}
    >
      {children}
    </Glass>
  );
}