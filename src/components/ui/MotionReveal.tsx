
"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

type MotionRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
};

export function MotionReveal({
  children,
  className,
  delay = 0,
  hover = false,
}: MotionRevealProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={
        shouldReduceMotion ? false : { opacity: 0, y: 14 }
      }
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.4,
        delay: shouldReduceMotion ? 0 : delay,
        ease: "easeOut",
      }}
      whileHover={
        hover && !shouldReduceMotion
          ? { y: -3, scale: 1.005 }
          : undefined
      }
    >
      {children}
    </motion.div>
  );
}