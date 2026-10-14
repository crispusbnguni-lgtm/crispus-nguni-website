
"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type FluidButtonProps = {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
};

const sizeClasses = {
  sm: "px-4 py-2.5 text-xs",
  md: "px-5 py-3 text-sm",
  lg: "px-7 py-3.5 text-sm",
} as const;

export function FluidButton({
  children,
  href,
  variant = "primary",
  size = "md",
  className = "",
  onClick,
  disabled = false,
  type = "button",
}: FluidButtonProps) {
  const classes = [
    "fluid-button",
    `fluid-button-${variant}`,
    sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <span className="fluid-button-content">
        {children}
      </span>

      <span
        aria-hidden="true"
        className="fluid-button-shine"
      />

      {href && (
        <span
          aria-hidden="true"
          className="fluid-button-arrow"
        >
           
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
          }
        }}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled}
    >
      {content}
    </button>
  );
}