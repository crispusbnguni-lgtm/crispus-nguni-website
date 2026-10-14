
"use client";

import type {
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import { Glass } from "@samasante/liquid-glass";

type LiquidLensButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  children: ReactNode;
};

export function LiquidLensButton({
  children,
  className = "",
  type = "button",
  style,
  ...buttonProps
}: LiquidLensButtonProps) {
  return (
    <Glass
      className="crispus-live-liquid-lens"
      style={{
        display: "inline-flex",
        position: "relative",
        overflow: "hidden",
        borderRadius: "999px",
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.48)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.65), 0 8px 24px rgba(0,0,0,0.12)",
      }}
      
optics={{
  strength: 0.14,
  depth: 0.95,
  curvature: 0.5,
  dispersion: 0.12,

  bend: 0.4,
  bendWidth: 0.07,

  specular: 1.2,
  sheen: 0.9,
  sheenWidth: 2.5,
  sheenFalloff: 1.5,
  sheenAngle: 45,

  frost: 0,
  brightness: 0,

  glow: 0.1,
  glowSpread: 1,
  glowFalloff: 0.8,
}}
    >
      <button
        {...buttonProps}
        type={type}
        className={`crispus-liquid-lens-button ${className}`}
        style={{
          ...style,
          position: "relative",
          zIndex: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 44,
          padding: "0.75rem 1.35rem",
          color: "inherit",
          font: "inherit",
          background: "transparent",
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
          border: 0,
          borderRadius: "inherit",
          boxShadow: "none",
          cursor: "pointer",
        }}
      >
        {children}
      </button>
    </Glass>
  );
}