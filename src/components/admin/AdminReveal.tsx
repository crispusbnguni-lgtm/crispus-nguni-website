"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { useAdminReducedMotion } from "./useAdminReducedMotion";

type AdminRevealProps = Readonly<{
  children: ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
}>;

export function AdminReveal({
  children,
  className,
  delay = 0,
  hover = false,
}: AdminRevealProps) {
  const reduceMotion = useAdminReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : 0.38,
        delay: reduceMotion ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={hover && !reduceMotion ? { y: -2 } : undefined}
    >
      {children}
    </motion.div>
  );
}
