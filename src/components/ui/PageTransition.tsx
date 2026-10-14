"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useReader } from "@/components/ui/ReaderProvider";

type PageTransitionProps = {
  children: ReactNode;
};

export function PageTransition({
  children,
}: PageTransitionProps) {
  const pathname = usePathname();
  const { preferences } = useReader();

  return (
    <div
      key={pathname}
      className={
        preferences.reduceMotion
          ? "min-h-screen"
          : "page-transition min-h-screen"
      }
    >
      {!preferences.reduceMotion && (
        <>
          <div
            aria-hidden="true"
            className="page-transition-cover"
          />

          <div
            aria-hidden="true"
            className="page-transition-spine"
          />
        </>
      )}

      {children}
    </div>
  );
}