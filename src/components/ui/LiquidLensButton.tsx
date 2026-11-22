
"use client";

import type {
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import { LensGlass } from "@/components/ui/LensGlass";

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
    <LensGlass
      className="crispus-live-liquid-lens"
      radius={999}
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
    </LensGlass>
  );
}
