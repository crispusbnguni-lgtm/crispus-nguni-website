
import type { CSSProperties, ReactNode } from "react";
import { safePortfolioBackground } from "@/lib/portfolio-public";

type PortfolioDesignProps = {
  theme?: string | null;
  websiteBackground?: string | null;
  children: ReactNode;
  className?: string;
};

export function PortfolioDesign({
  theme,
  websiteBackground,
  children,
  className = "",
}: PortfolioDesignProps) {
  const isLight = theme === "light";
  const isSepia = theme === "sepia";

  const defaultBackground = (
    isLight ? "#F5F7FB" : isSepia ? "#F3E8D0" : "#05070D"
  );
  const parsedBackground = safePortfolioBackground(websiteBackground);
  const isImage = parsedBackground?.kind === "image";
  const background = parsedBackground?.kind === "color"
    ? parsedBackground.value
    : defaultBackground;
  const backgroundImage = isImage ? parsedBackground.value : null;

  const style: CSSProperties = {
    "--portfolio-bg": isImage
      ? isLight
        ? "#F5F7FB"
        : isSepia
          ? "#F3E8D0"
          : "#05070D"
      : background,
    "--portfolio-text": isLight
      ? "#172033"
      : isSepia
        ? "#46351F"
        : "#FFFFFF",
    "--portfolio-muted": isLight
      ? "#596579"
      : isSepia
        ? "#78664E"
        : "rgba(255,255,255,0.60)",
    "--portfolio-border": isLight
      ? "rgba(23,32,51,0.12)"
      : isSepia
        ? "rgba(70,53,31,0.16)"
        : "rgba(255,255,255,0.12)",
    "--portfolio-surface": isLight
      ? "rgba(255,255,255,0.76)"
      : isSepia
        ? "rgba(255,250,239,0.72)"
        : "rgba(255,255,255,0.045)",
    "--portfolio-accent": "#D9A441",
  } as CSSProperties;

  return (
    <main
      className={`portfolio-design min-h-screen ${className}`}
      data-portfolio-theme={theme || "dark"}
      style={{
        ...style,
        backgroundColor: isImage ? "#05070D" : background,
        color: "var(--portfolio-text)",
        ...(isImage
          ? {
              backgroundImage: `url("${backgroundImage}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundAttachment: "fixed",
            }
          : {}),
      }}
    >
      {children}
    </main>
  );
}
