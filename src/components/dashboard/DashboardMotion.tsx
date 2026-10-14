
"use client";

import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

type MotionRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
};

export function MotionReveal({
  children,
  className,
  delay = 0,
  y = 18,
}: MotionRevealProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={
        reduceMotion
          ? false
          : {
              opacity: 0,
              y,
            }
      }
      whileInView={
        reduceMotion
          ? undefined
          : {
              opacity: 1,
              y: 0,
            }
      }
      viewport={{
        once: true,
        amount: 0.12,
      }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              duration: 0.65,
              delay: Math.max(0, delay),
              ease: EASE_OUT,
            }
      }
    >
      {children}
    </motion.div>
  );
}

type MotionCardProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

export function MotionCard({
  children,
  className,
  delay = 0,
}: MotionCardProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={
        reduceMotion
          ? false
          : {
              opacity: 0,
              y: 16,
              scale: 0.99,
            }
      }
      whileInView={
        reduceMotion
          ? undefined
          : {
              opacity: 1,
              y: 0,
              scale: 1,
            }
      }
      viewport={{
        once: true,
        amount: 0.12,
      }}
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: -3,
              scale: 1.008,
              transition: {
                type: "spring",
                stiffness: 300,
                damping: 26,
              },
            }
      }
      whileTap={
        reduceMotion
          ? undefined
          : {
              scale: 0.995,
            }
      }
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              duration: 0.55,
              delay: Math.max(0, delay),
              ease: EASE_OUT,
            }
      }
    >
      {children}
    </motion.div>
  );
}

type MotionCountProps = {
  value: number;
  className?: string;
};

export function MotionCount({
  value,
  className,
}: MotionCountProps) {
  const ref = useRef<HTMLSpanElement>(null);

  const isInView = useInView(ref, {
    once: true,
    amount: 0.6,
  });

  const reduceMotion = useReducedMotion();
  const count = useMotionValue(0);

  const formattedCount = useTransform(count, (latest) =>
    Math.round(latest).toLocaleString(),
  );

  useEffect(() => {
    if (reduceMotion) {
      count.set(value);
      return;
    }

    if (!isInView) return;

    const controls = animate(count, value, {
      duration: 0.9,
      ease: EASE_OUT,
    });

    return () => controls.stop();
  }, [count, isInView, reduceMotion, value]);

  return (
    <motion.span
      ref={ref}
      className={className}
      aria-label={value.toLocaleString()}
    >
      {formattedCount}
    </motion.span>
  );
}

export function MotionArrow({
  children,
}: {
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.span
      className="inline-flex shrink-0"
      aria-hidden="true"
      animate={
        reduceMotion
          ? undefined
          : {
              x: [0, 3, 0],
            }
      }
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              duration: 1.8,
              repeat: Infinity,
              ease: "easeInOut",
            }
      }
    >
      {children}
    </motion.span>
  );
}