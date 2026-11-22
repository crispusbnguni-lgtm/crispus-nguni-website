"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { safePortfolioImageUrl } from "@/lib/portfolio-public";

export function PortfolioImage({
  src,
  alt,
  className,
  fallback,
  sizes = "100vw",
  priority = false,
}: {
  src: unknown;
  alt: string;
  className: string;
  fallback: ReactNode;
  sizes?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const safeSrc = safePortfolioImageUrl(src);

  if (!safeSrc || failed) return <>{fallback}</>;

  return (
    <Image
      src={safeSrc}
      alt={alt}
      fill
      unoptimized
      priority={priority}
      sizes={sizes}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
