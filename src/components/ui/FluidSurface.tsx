
"use client";

import {
  type CSSProperties,
  type HTMLAttributes,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useRef,
} from "react";

type FluidSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  intensity?: "subtle" | "medium" | "strong";
};

const intensityValues = {
  subtle: 0.06,
  medium: 0.1,
  strong: 0.16,
} as const;

export function FluidSurface({
  children,
  intensity = "medium",
  className = "",
  style,
  onPointerMove,
  onPointerLeave,
  ...props
}: FluidSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      onPointerMove?.(event);

      if (event.pointerType === "touch") return;

      const element = surfaceRef.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();

      if (!rect.width || !rect.height) return;

      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;

      element.style.setProperty("--fluid-x", `${x}%`);
      element.style.setProperty("--fluid-y", `${y}%`);
    },
    [onPointerMove],
  );

  const handlePointerLeave = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      onPointerLeave?.(event);

      const element = surfaceRef.current;
      if (!element) return;

      element.style.setProperty("--fluid-x", "50%");
      element.style.setProperty("--fluid-y", "50%");
    },
    [onPointerLeave],
  );

  const surfaceStyle = {
    "--fluid-x": "50%",
    "--fluid-y": "50%",
    "--fluid-opacity": intensityValues[intensity],
    ...style,
  } as CSSProperties;

  return (
    <div
      {...props}
      ref={surfaceRef}
      style={surfaceStyle}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`fluid-surface ${className}`.trim()}
    >
      <div
        aria-hidden="true"
        className="fluid-surface-light"
      />

      <div
        aria-hidden="true"
        className="fluid-surface-highlight"
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
}