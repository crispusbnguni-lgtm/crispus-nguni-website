
"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.99 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1],
      when: "beforeChildren",
      staggerChildren: 0.065,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export default function LoginPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Unable to log in.");
        return;
      }

      router.push("/dashboard");
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const entrance = reduceMotion
    ? {}
    : {
        initial: "hidden" as const,
        animate: "visible" as const,
        variants: cardVariants,
      };

  return (
    <main className="relative isolate flex min-h-[100svh] w-full items-start justify-center overflow-x-clip px-3 py-5 text-white sm:px-5 sm:py-8 lg:items-center">
      {/* Ambient light uses the installed Framer Motion library. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed -left-32 top-10 z-0 h-72 w-72 rounded-full bg-[#126BFF]/15 blur-[100px] sm:h-96 sm:w-96"
        animate={
          reduceMotion
            ? undefined
            : { x: [0, 25, 0], y: [0, 20, 0], scale: [1, 1.08, 1] }
        }
        transition={{
          duration: 14,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed -bottom-32 -right-24 z-0 h-80 w-80 rounded-full bg-[#722BFF]/15 blur-[100px] sm:h-96 sm:w-96"
        animate={
          reduceMotion
            ? undefined
            : { x: [0, -20, 0], y: [0, -18, 0], scale: [1, 1.1, 1] }
        }
        transition={{
          duration: 17,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        {...entrance}
        className="relative z-10 mx-auto w-full max-w-6xl"
      >
        {/* The glass surface now covers the complete authentication card. */}
        <LiquidLensSurface
          radius={32}
          intensity="strong"
          className="overflow-hidden border border-white/15 bg-[#080C16]/55 text-white shadow-[0_25px_100px_rgba(0,0,0,0.35)] backdrop-blur-2xl"
        >
          <motion.div
            layout={!reduceMotion}
            className="grid w-full min-w-0 lg:grid-cols-2"
          >
            {/* Promotional panel */}
            <motion.section
              variants={reduceMotion ? undefined : itemVariants}
              className="site-glass relative hidden overflow-hidden border-b border-white/10 bg-white/[0.035] p-10 lg:flex lg:flex-col lg:justify-between lg:border-b-0 lg:border-r xl:p-12"
            >
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#126BFF]/20 blur-3xl"
                animate={
                  reduceMotion
                    ? undefined
                    : { x: [0, 18, 0], y: [0, 12, 0], scale: [1, 1.08, 1] }
                }
                transition={{
                  duration: 12,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-[#722BFF]/15 blur-3xl"
                animate={
                  reduceMotion
                    ? undefined
                    : { x: [0, -16, 0], y: [0, -12, 0], scale: [1, 1.1, 1] }
                }
                transition={{
                  duration: 15,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              <div className="relative z-10">
                <Link
                  href="/"
                  className="inline-flex text-2xl font-semibold tracking-tight transition-colors hover:text-white/80"
                >
                  Crispus<span className="text-[#126BFF]">.</span>
                </Link>
              </div>

              <div className="relative z-10 my-8 max-w-lg">
                <motion.p
                  variants={reduceMotion ? undefined : itemVariants}
                  className="text-sm font-medium uppercase tracking-[0.3em] text-[#D9A441]"
                >
                  Welcome back
                </motion.p>

                <motion.h1
                  variants={reduceMotion ? undefined : itemVariants}
                  className="mt-6 text-4xl font-semibold leading-tight xl:text-5xl"
                >
                  Manage your professional presence.
                </motion.h1>

                <motion.p
                  variants={reduceMotion ? undefined : itemVariants}
                  className="mt-6 text-base leading-8 text-white/65 xl:text-lg"
                >
                  Log in to access your portfolio dashboard, update your
                  information and manage your published site.
                </motion.p>

                <div className="mt-8 grid gap-3">
                  {[
                    "Manage your portfolio",
                    "Update your professional information",
                    "Customize your site",
                    "Control your publishing status",
                  ].map((item) => (
                    <motion.div
                      key={item}
                      variants={reduceMotion ? undefined : itemVariants}
                      whileHover={reduceMotion ? undefined : { x: 5 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 24,
                      }}
                      className="flex items-center gap-3 text-sm text-white/75"
                    >
                      <motion.span
                        whileHover={
                          reduceMotion ? undefined : { rotate: 8, scale: 1.08 }
                        }
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#126BFF]/30 bg-[#126BFF]/15 text-[#5d9bff]"
                      >
                        ✓
                      </motion.span>
                      {item}
                    </motion.div>
                  ))}
                </div>
              </div>

              <p className="relative z-10 text-xs text-white/40">
                Professional Portfolio Platform
              </p>
            </motion.section>

            {/* Login form: no nested scroll container or fixed height. */}
            <motion.section
              variants={reduceMotion ? undefined : itemVariants}
              className="relative flex min-w-0 items-center justify-center p-6 sm:p-9 lg:p-10 xl:p-12"
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.045] via-transparent to-[#126BFF]/[0.06]" />

              <div className="relative z-10 w-full max-w-md">
                <motion.div
                  variants={reduceMotion ? undefined : itemVariants}
                  className="mb-7 lg:hidden"
                >
                  <Link
                    href="/"
                    className="text-2xl font-semibold tracking-tight"
                  >
                    Crispus<span className="text-[#126BFF]">.</span>
                  </Link>
                </motion.div>

                <motion.div
                  variants={reduceMotion ? undefined : itemVariants}
                >
                  <p className="text-sm font-medium uppercase tracking-[0.25em] text-[#D9A441]">
                    Welcome back
                  </p>

                  <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                    Log in to your account
                  </h2>

                  <p className="mt-3 leading-7 text-white/60">
                    Continue managing your professional portfolio.
                  </p>
                </motion.div>

                <motion.form
                  onSubmit={handleSubmit}
                  initial={reduceMotion ? false : "hidden"}
                  animate="visible"
                  variants={
                    reduceMotion
                      ? undefined
                      : {
                          hidden: {},
                          visible: {
                            transition: { staggerChildren: 0.08 },
                          },
                        }
                  }
                  className="mt-7 space-y-5"
                >
                  <motion.div
                    variants={reduceMotion ? undefined : itemVariants}
                  >
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm text-white/75"
                    >
                      Email address
                    </label>

                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full rounded-2xl border border-white/15 bg-white/[0.055] px-4 py-3.5 text-white outline-none transition duration-300 placeholder:text-white/35 focus:border-[#5d9bff]/70 focus:bg-white/[0.09] focus:ring-2 focus:ring-[#126BFF]/15"
                    />
                  </motion.div>

                  <motion.div
                    variants={reduceMotion ? undefined : itemVariants}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label
                        htmlFor="password"
                        className="block text-sm text-white/75"
                      >
                        Password
                      </label>

                      <Link
                        href="/forgot-password"
                        className="text-sm text-[#8ab5ff] transition-colors duration-300 hover:text-white"
                      >
                        Forgot password?
                      </Link>
                    </div>

                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Your password"
                        required
                        className="w-full rounded-2xl border border-white/15 bg-white/[0.055] px-4 py-3.5 pr-14 text-white outline-none transition duration-300 placeholder:text-white/35 focus:border-[#5d9bff]/70 focus:bg-white/[0.09] focus:ring-2 focus:ring-[#126BFF]/15"
                      />

                      <motion.button
                        type="button"
                        whileHover={reduceMotion ? undefined : { scale: 1.08 }}
                        whileTap={reduceMotion ? undefined : { scale: 0.92 }}
                        onClick={() => setShowPassword((value) => !value)}
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-white/55 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </motion.button>
                    </div>
                  </motion.div>

                  <AnimatePresence initial={false}>
                    {message && (
                      <motion.div
                        key="login-error"
                        initial={
                          reduceMotion
                            ? false
                            : { opacity: 0, height: 0, y: -5 }
                        }
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={
                          reduceMotion
                            ? undefined
                            : { opacity: 0, height: 0, y: -5 }
                        }
                        transition={{ duration: 0.25 }}
                        role="alert"
                        aria-live="polite"
                        className="overflow-hidden"
                      >
                        <div className="rounded-2xl border border-red-400/25 bg-red-400/[0.08] px-4 py-3 text-sm text-red-200">
                          {message}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div
                    variants={reduceMotion ? undefined : itemVariants}
                  >
                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileHover={
                        reduceMotion || loading
                          ? undefined
                          : { y: -2, scale: 1.005 }
                      }
                      whileTap={
                        reduceMotion || loading
                          ? undefined
                          : { scale: 0.985 }
                      }
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 25,
                      }}
                      className="relative w-full overflow-hidden rounded-2xl border border-white/20 bg-[#126BFF]/90 px-5 py-3.5 font-medium text-white shadow-[0_8px_30px_rgba(18,107,255,0.22)] backdrop-blur-xl transition-[background-color,box-shadow] duration-300 hover:bg-[#2477ff] hover:shadow-[0_0_35px_rgba(18,107,255,0.3)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {!reduceMotion && !loading && (
                        <motion.span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-y-0 left-[-40%] w-1/3 skew-x-[-20deg] bg-white/20 blur-sm"
                          animate={{ left: ["-40%", "140%"] }}
                          transition={{
                            duration: 3.5,
                            repeat: Infinity,
                            repeatDelay: 2,
                            ease: "easeInOut",
                          }}
                        />
                      )}

                      <span className="relative z-10 inline-flex items-center justify-center gap-2">
                        {loading && (
                          <motion.span
                            aria-hidden="true"
                            className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                            animate={
                              reduceMotion ? undefined : { rotate: 360 }
                            }
                            transition={{
                              duration: 0.8,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                          />
                        )}
                        {loading ? "Logging in..." : "Log In"}
                      </span>
                    </motion.button>
                  </motion.div>
                </motion.form>

                <motion.p
                  variants={reduceMotion ? undefined : itemVariants}
                  className="mt-6 text-center text-sm text-white/55"
                >
                  Don&apos;t have an account?{" "}
                  <Link
                    href="/signup"
                    className="text-white transition-colors duration-300 hover:text-[#8ab5ff]"
                  >
                    Create one
                  </Link>
                </motion.p>

                <motion.div
                  variants={reduceMotion ? undefined : itemVariants}
                  className="mt-7 border-t border-white/10 pt-5 text-center"
                >
                  <Link
                    href="/"
                    className="text-sm text-white/45 transition-colors duration-300 hover:text-white/80"
                  >
                    Back to website
                  </Link>
                </motion.div>
              </div>
            </motion.section>
          </motion.div>
        </LiquidLensSurface>
      </motion.div>
    </main>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12s3.75-6 9.75-6 9.75 6 9.75 6-3.75 6-9.75 6-9.75-6-9.75-6Z"
      />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.58 10.58A2 2 0 0 0 13.42 13.42"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.88 5.24A10.75 10.75 0 0 1 12 5c6 0 9.75 7 9.75 7a18.25 18.25 0 0 1-3.1 3.91"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.61 6.61C4.05 8.22 2.25 12 2.25 12a18.25 18.25 0 0 0 4.67 4.88A10.66 10.66 0 0 0 12 19c1.2 0 2.3-.22 3.3-.58"
      />
    </svg>
  );
}
