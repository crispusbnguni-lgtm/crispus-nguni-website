"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

export function useAdminReducedMotion() {
  const systemPrefersReducedMotion = useReducedMotion();
  const [readerPrefersReducedMotion, setReaderPrefersReducedMotion] =
    useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      setReaderPrefersReducedMotion(root.dataset.reduceMotion === "true");
    };

    update();
    const observer = new MutationObserver(update);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-reduce-motion"],
    });

    return () => observer.disconnect();
  }, []);

  return Boolean(systemPrefersReducedMotion || readerPrefersReducedMotion);
}
