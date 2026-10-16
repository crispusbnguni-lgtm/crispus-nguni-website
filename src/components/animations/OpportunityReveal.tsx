
"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";

const INTRO_KEY = "crispus-intro-seen";

const stages = [
  { code: "CR", meaning: "CREATE RESILIENCE" },
  { code: "IS", meaning: "INTEGRITY & SERVICE" },
  { code: "PU", meaning: "PURPOSE UNLOCKED" },
  { code: "S", meaning: "SUCCESS" },
] as const;

const particles = Array.from({ length: 36 }, (_, i) => ({
  id: i,
  left: `${(i * 47 + 13) % 100}%`,
  top: `${(i * 67 + 19) % 100}%`,
  delay: (i % 9) * 0.17,
  duration: 3.5 + (i % 7) * 0.65,
  size: 2 + (i % 3),
}));

const easePremium = [0.22, 1, 0.36, 1] as const;

function hasSeenIntro() {
  try {
    return sessionStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return false;
  }
}

function markIntroSeen() {
  try {
    sessionStorage.setItem(INTRO_KEY, "1");
  } catch {
    // The intro can finish without browser storage.
  }
}

export function OpportunityReveal() {
  // These initial values must match on the server and first client render.
  const [finished, setFinished] = useState(false);
  const [introReady, setIntroReady] = useState(false);
  const [stage, setStage] = useState(-1);

  const shouldReduceMotion = useReducedMotion();

  // Read sessionStorage only after hydration.
  useEffect(() => {
    setFinished(hasSeenIntro());
    setIntroReady(true);
  }, []);

  // Run the introduction only after checking whether it was already seen.
  useEffect(() => {
    if (!introReady || finished) return;

    const complete = () => {
      markIntroSeen();
      setFinished(true);
    };

    const mediaQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    if (mediaQuery.matches || shouldReduceMotion) {
      const timer = window.setTimeout(complete, 500);
      return () => window.clearTimeout(timer);
    }

    const timers = [
      window.setTimeout(() => setStage(0), 700),
      window.setTimeout(() => setStage(1), 1550),
      window.setTimeout(() => setStage(2), 2400),
      window.setTimeout(() => setStage(3), 3250),
      window.setTimeout(complete, 6900),
    ];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [introReady, finished, shouldReduceMotion]);

  return (
    <AnimatePresence>
      {introReady && !finished && (
        <motion.div
          key="crispus-opportunity-intro"
          role="status"
          aria-label="Introducing Crispus Nguni"
          aria-live="polite"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: 1.025,
            filter: "blur(12px)",
          }}
          transition={{
            duration: 0.75,
            ease: easePremium,
          }}
          className="fixed inset-0 z-[9999] isolate flex min-h-[100svh] items-center justify-center overflow-hidden bg-[#050711] text-white"
        >
          {/* Atmospheric background */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_43%,rgba(35,64,130,0.28),transparent_48%),radial-gradient(ellipse_at_15%_85%,rgba(13,148,136,0.10),transparent_38%),radial-gradient(ellipse_at_90%_10%,rgba(180,133,58,0.12),transparent_32%)]" />

            <div
              className="absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)",
                backgroundSize: "64px 64px",
                maskImage:
                  "radial-gradient(ellipse at center, black 0%, transparent 78%)",
              }}
            />

            <motion.div
              className="absolute -left-32 top-[12%] h-80 w-80 rounded-full bg-blue-500/[0.10] blur-[100px]"
              animate={
                shouldReduceMotion
                  ? undefined
                  : {
                      x: [0, 80, 20, 0],
                      y: [0, 45, 100, 0],
                      scale: [1, 1.2, 0.9, 1],
                    }
              }
              transition={{
                duration: 12,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            <motion.div
              className="absolute -right-28 bottom-[5%] h-96 w-96 rounded-full bg-teal-400/[0.09] blur-[110px]"
              animate={
                shouldReduceMotion
                  ? undefined
                  : {
                      x: [0, -60, -10, 0],
                      y: [0, -70, -20, 0],
                      scale: [1, 0.85, 1.15, 1],
                    }
              }
              transition={{
                duration: 14,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            {/* Floating particles */}
            {particles.map((particle) => (
              <motion.span
                key={particle.id}
                className="absolute rounded-full bg-white"
                style={{
                  left: particle.left,
                  top: particle.top,
                  width: particle.size,
                  height: particle.size,
                  opacity: 0.24,
                  boxShadow:
                    particle.id % 5 === 0
                      ? "0 0 12px rgba(125,211,252,.85)"
                      : undefined,
                }}
                animate={
                  shouldReduceMotion
                    ? undefined
                    : {
                        y: [0, -24, 8, 0],
                        x: [
                          0,
                          particle.id % 2 ? 10 : -10,
                          0,
                        ],
                        opacity: [0.12, 0.65, 0.2, 0.12],
                      }
                }
                transition={{
                  duration: particle.duration,
                  delay: particle.delay,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>

          {/* Main composition */}
          <div className="relative z-10 flex w-full max-w-5xl flex-col items-center px-6 pb-12 pt-8 text-center sm:px-10">
            {/* Brand introduction */}
            <motion.div
              initial={
                shouldReduceMotion
                  ? false
                  : {
                      opacity: 0,
                      y: -18,
                      letterSpacing: "0.35em",
                    }
              }
              animate={{
                opacity: 1,
                y: 0,
                letterSpacing: "0.24em",
              }}
              transition={{ duration: 1, delay: 0.15 }}
              className="mb-5 flex items-center gap-3 text-[9px] font-medium uppercase text-slate-400 sm:text-[10px]"
            >
              <span className="h-px w-7 bg-gradient-to-r from-transparent to-cyan-200/70" />
              A personal brand built with purpose
              <span className="h-px w-7 bg-gradient-to-l from-transparent to-cyan-200/70" />
            </motion.div>

            {/* Liquid Glass monogram */}
            <motion.div
              initial={
                shouldReduceMotion
                  ? false
                  : {
                      opacity: 0,
                      scale: 0.68,
                      rotateX: 24,
                      rotateY: -28,
                      filter: "blur(14px)",
                    }
              }
              animate={{
                opacity: 1,
                scale: 1,
                rotateX: 0,
                rotateY: 0,
                filter: "blur(0px)",
              }}
              transition={{
                duration: 1.35,
                delay: 0.25,
                type: "spring",
                stiffness: 75,
                damping: 17,
              }}
              className="relative mb-7"
              style={{ perspective: 1000 }}
            >
              <motion.div
                className="absolute -inset-7 rounded-[42%] border border-cyan-200/15"
                animate={
                  shouldReduceMotion
                    ? undefined
                    : { rotate: 360, scale: [1, 1.045, 1] }
                }
                transition={{
                  rotate: {
                    duration: 28,
                    repeat: Infinity,
                    ease: "linear",
                  },
                  scale: {
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  },
                }}
              />

              <motion.div
                className="absolute -inset-4 rounded-full border border-white/[0.08]"
                animate={
                  shouldReduceMotion ? undefined : { rotate: -360 }
                }
                transition={{
                  duration: 36,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />

              <motion.div
                className="absolute -inset-7"
                animate={
                  shouldReduceMotion ? undefined : { rotate: 360 }
                }
                transition={{
                  duration: 12,
                  repeat: Infinity,
                  ease: "linear",
                }}
              >
                <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-cyan-200 shadow-[0_0_18px_5px_rgba(103,232,249,0.45)]" />
              </motion.div>

              <motion.div
                className="relative flex h-36 w-36 items-center justify-center overflow-hidden rounded-[30px] border border-white/20 bg-gradient-to-br from-white/[0.17] via-white/[0.055] to-cyan-300/[0.06] shadow-[0_28px_100px_-25px_rgba(34,211,238,0.24),inset_0_1px_1px_rgba(255,255,255,0.28),inset_0_-20px_45px_rgba(30,64,175,0.12)] backdrop-blur-2xl sm:h-44 sm:w-44 sm:rounded-[36px]"
                animate={
                  shouldReduceMotion
                    ? undefined
                    : {
                        y: [0, -7, 0],
                        rotateZ: [0, 1.2, 0, -1.2, 0],
                      }
                }
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{ transformStyle: "preserve-3d" }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_25%_0%,rgba(255,255,255,.26),transparent_48%)]" />

                <motion.div
                  className="absolute -left-1/2 top-0 h-full w-1/2 rotate-[24deg] bg-gradient-to-r from-transparent via-white/[0.16] to-transparent"
                  animate={
                    shouldReduceMotion
                      ? undefined
                      : { x: ["-20%", "370%"] }
                  }
                  transition={{
                    duration: 3.8,
                    repeat: Infinity,
                    repeatDelay: 1.6,
                    ease: "easeInOut",
                  }}
                />

                <span className="relative z-10 bg-gradient-to-br from-white via-cyan-100 to-slate-300 bg-clip-text text-7xl font-semibold tracking-[-0.1em] text-transparent sm:text-8xl">
                  C<span className="relative -ml-1">N</span>
                </span>

                <span className="absolute bottom-3 left-0 right-0 text-center text-[8px] tracking-[0.42em] text-white/45">
                  EST. WITH PURPOSE
                </span>
              </motion.div>
            </motion.div>

            {/* Wordmark */}
            <motion.div
              initial={
                shouldReduceMotion
                  ? false
                  : { opacity: 0, y: 24, filter: "blur(8px)" }
              }
              animate={{
                opacity: 1,
                y: 0,
                filter: "blur(0px)",
              }}
              transition={{
                duration: 0.9,
                delay: 0.55,
                ease: easePremium,
              }}
              className="mb-3"
            >
              <h1 className="text-4xl font-medium tracking-[-0.075em] sm:text-6xl md:text-7xl">
                CRISPUS<span className="text-cyan-200">.</span>
              </h1>
            </motion.div>

            <motion.p
              initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="mb-9 max-w-md text-xs leading-6 tracking-[0.12em] text-slate-400 sm:text-sm"
            >
              YOUR WORK. YOUR STORY.
              <br />
              <span className="text-slate-200">
                YOUR NEXT OPPORTUNITY.
              </span>
            </motion.p>

            {/* Opportunity stages */}
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1 }}
              className="w-full max-w-md"
            >
              <div className="mb-4 flex items-center justify-center gap-3">
                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/15" />
                <span className="text-[9px] font-medium tracking-[0.3em] text-slate-500">
                  THE CODE OF OPPORTUNITY
                </span>
                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/15" />
              </div>

              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {stages.map((item, index) => {
                  const active = index <= stage;

                  return (
                    <motion.div
                      key={item.code}
                      initial={false}
                      animate={{
                        opacity: active ? 1 : 0.3,
                        y: active ? 0 : 4,
                        scale: active ? 1 : 0.96,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 180,
                        damping: 20,
                      }}
                      className={`relative overflow-hidden rounded-xl border px-1 py-3 backdrop-blur-xl transition-colors duration-500 sm:rounded-2xl sm:py-4 ${
                        active
                          ? "border-cyan-200/30 bg-cyan-100/[0.09] shadow-[0_0_24px_rgba(34,211,238,0.08)]"
                          : "border-white/[0.07] bg-white/[0.025]"
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="opportunity-active-indicator"
                          className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200 to-transparent"
                        />
                      )}

                      <span
                        className={`block text-lg font-medium tracking-tight sm:text-2xl ${
                          active ? "text-white" : "text-slate-500"
                        }`}
                      >
                        {item.code}
                      </span>

                      <span className="mt-1 block text-[7px] tracking-[0.12em] text-slate-500 sm:text-[8px]">
                        0{index + 1}
                      </span>
                    </motion.div>
                  );
                })}
              </div>

              <div className="relative mt-5 min-h-6 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={stage}
                    initial={
                      shouldReduceMotion
                        ? false
                        : { opacity: 0, y: 10, filter: "blur(5px)" }
                    }
                    animate={{
                      opacity: 1,
                      y: 0,
                      filter: "blur(0px)",
                    }}
                    exit={
                      shouldReduceMotion
                        ? undefined
                        : { opacity: 0, y: -8, filter: "blur(4px)" }
                    }
                    transition={{ duration: 0.35 }}
                    className="text-[10px] font-medium tracking-[0.24em] text-cyan-100/80 sm:text-[11px]"
                  >
                    {stage >= 0
                      ? stages[stage]?.meaning
                      : "EVERY GREAT STORY BEGINS"}
                  </motion.p>
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Animated progress */}
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.8 }}
              className="mt-9 w-48 max-w-full"
            >
              <div className="mb-2 flex items-center justify-between text-[8px] tracking-[0.18em] text-slate-500">
                <span>PREPARING YOUR EXPERIENCE</span>
                <span className="tabular-nums">
                  {Math.round(
                    ((stage + 1) / stages.length) * 100,
                  )
                    .toString()
                    .padStart(2, "0")}
                  %
                </span>
              </div>

              <div className="h-[2px] overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div
                  className="h-full origin-left rounded-full bg-gradient-to-r from-blue-400 via-cyan-200 to-white shadow-[0_0_12px_rgba(103,232,249,0.6)]"
                  initial={{ scaleX: 0 }}
                  animate={{
                    scaleX: Math.max(0, stage + 1) / stages.length,
                  }}
                  transition={{
                    duration: 0.7,
                    ease: easePremium,
                  }}
                />
              </div>
            </motion.div>
          </div>

          {/* Footer */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, duration: 0.8 }}
            className="absolute bottom-5 left-0 right-0 px-4 text-center"
          >
            <span className="text-[8px] tracking-[0.2em] text-slate-600 sm:text-[9px]">
              BUILT WITH PURPOSE
              <span className="mx-2 text-cyan-200/60">·</span>
              DESIGNED FOR OPPORTUNITY
            </span>
          </motion.div>

          {/* Subtle glass edge */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 border border-white/[0.035]"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
