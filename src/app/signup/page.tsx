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
hidden: { opacity: 0, y: 24, scale: 0.985 },
visible: {
opacity: 1,
y: 0,
scale: 1,
transition: {
duration: 0.65,
ease: [0.22, 1, 0.36, 1],
when: "beforeChildren",
staggerChildren: 0.07,
},
},
};

const itemVariants: Variants = {
hidden: { opacity: 0, y: 14 },
visible: {
opacity: 1,
y: 0,
transition: {
duration: 0.42,
ease: [0.22, 1, 0.36, 1],
},
},
};

const features = [
"Your own portfolio dashboard",
"Professional templates",
"Manage your information in one place",
"Publish when you are ready",
];

export default function SignupPage() {
const router = useRouter();
const reduceMotion = useReducedMotion();

const [name, setName] = useState("");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");

const [showPassword, setShowPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);

const [message, setMessage] = useState("");
const [loading, setLoading] = useState(false);

async function handleSubmit(event: FormEvent<HTMLFormElement>) {
event.preventDefault();
setMessage("");


if (password.length < 8) {
  setMessage("Password must be at least 8 characters.");
  return;
}

if (password !== confirmPassword) {
  setMessage("Passwords do not match.");
  return;
}

setLoading(true);

try {
  const response = await fetch("/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      email,
      password,
      confirmPassword,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    setMessage(data.message || "Unable to create your account.");
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

const staggerVariants: Variants = {
hidden: {},
visible: {
transition: reduceMotion ? {} : { staggerChildren: 0.065 },
},
};

return ( <main className="relative isolate flex min-h-[100svh] w-full items-start justify-center overflow-x-clip px-3 py-5 text-white sm:px-5 sm:py-8 lg:items-center lg:py-10">
{/* Decorative light remains behind the glass card. */}
<motion.div
aria-hidden="true"
className="pointer-events-none fixed -right-32 -top-32 z-0 h-80 w-80 rounded-full bg-[#126BFF]/15 blur-[100px] sm:h-96 sm:w-96"
animate={
reduceMotion
? undefined
: {
x: [0, 18, 0],
y: [0, 14, 0],
scale: [1, 1.08, 1],
}
}
transition={{
duration: 13,
repeat: Infinity,
ease: "easeInOut",
}}
/>


  <motion.div
    aria-hidden="true"
    className="pointer-events-none fixed -bottom-32 -left-32 z-0 h-80 w-80 rounded-full bg-[#722BFF]/15 blur-[100px] sm:h-96 sm:w-96"
    animate={
      reduceMotion
        ? undefined
        : {
            x: [0, -15, 0],
            y: [0, -12, 0],
            scale: [1, 1.1, 1],
          }
    }
    transition={{
      duration: 16,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  />

  <motion.div
    {...entrance}
    className="relative z-10 mx-auto my-auto w-full max-w-6xl"
  >
    <LiquidLensSurface
      radius={32}
      intensity="strong"
      className="overflow-hidden border border-white/15 bg-[#080C16]/65 text-white shadow-[0_25px_100px_rgba(0,0,0,0.38)] backdrop-blur-2xl"
    >
      <motion.div
        layout={!reduceMotion}
        className="grid w-full min-w-0 lg:grid-cols-2"
      >
        {/* Promotional panel */}
        <motion.section
          variants={reduceMotion ? undefined : itemVariants}
          className="site-glass relative hidden min-h-full overflow-hidden border-r border-white/10 bg-white/[0.035] p-10 backdrop-blur-2xl lg:flex lg:flex-col lg:justify-between lg:p-12"
        >
          <motion.div
            aria-hidden="true"
            animate={
              reduceMotion
                ? undefined
                : {
                    x: [0, 18, 0],
                    y: [0, 12, 0],
                    scale: [1, 1.08, 1],
                  }
            }
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#126BFF]/25 blur-3xl"
          />

          <motion.div
            aria-hidden="true"
            animate={
              reduceMotion
                ? undefined
                : {
                    x: [0, -16, 0],
                    y: [0, -12, 0],
                    scale: [1, 1.1, 1],
                  }
            }
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-[#722BFF]/20 blur-3xl"
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
              Build your presence
            </motion.p>

            <motion.h1
              variants={reduceMotion ? undefined : itemVariants}
              className="mt-6 text-4xl font-semibold leading-tight xl:text-5xl"
            >
              Your work deserves a professional home.
            </motion.h1>

            <motion.p
              variants={reduceMotion ? undefined : itemVariants}
              className="mt-6 text-base leading-8 text-white/65 xl:text-lg"
            >
              Create your account and build a professional portfolio you
              can customize, manage and publish.
            </motion.p>

            <div className="mt-8 grid gap-3">
              {features.map((item) => (
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
                      reduceMotion
                        ? undefined
                        : { rotate: 8, scale: 1.08 }
                    }
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#126BFF]/30 bg-[#126BFF]/15 text-[#5d9bff]"
                  >
                    ✓
                  </motion.span>
                  <span>{item}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <p className="relative z-10 text-xs text-white/35">
            Professional Portfolio Platform
          </p>
        </motion.section>

        {/* Signup form */}
        <motion.section
          variants={reduceMotion ? undefined : itemVariants}
          className="relative min-w-0 bg-white/[0.015] p-5 sm:p-8 md:p-10 lg:p-10 xl:p-12"
        >
          {/* Subtle glass highlight behind the form content. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(18,107,255,0.09),transparent_48%)]"
          />

          <div className="relative z-10 mx-auto w-full max-w-md">
            <motion.div
              variants={reduceMotion ? undefined : itemVariants}
              className="mb-7 lg:hidden"
            >
              <Link
                href="/"
                className="inline-flex text-2xl font-semibold tracking-tight"
              >
                Crispus<span className="text-[#126BFF]">.</span>
              </Link>

              <p className="mt-3 text-sm text-white/45">
                Professional Portfolio Platform
              </p>
            </motion.div>

            <motion.div
              variants={reduceMotion ? undefined : itemVariants}
            >
              <p className="text-sm font-medium uppercase tracking-[0.25em] text-[#D9A441]">
                Get started
              </p>

              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Create your account
              </h2>

              <p className="mt-3 leading-7 text-white/55">
                Start building your professional portfolio.
              </p>
            </motion.div>

            <motion.form
              onSubmit={handleSubmit}
              variants={staggerVariants}
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              className="mt-7 space-y-5"
            >
              {/* Full name */}
              <motion.div
                variants={reduceMotion ? undefined : itemVariants}
              >
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-medium text-white/75"
                >
                  Full name
                </label>

                <LiquidLensSurface
                  radius={16}
                  intensity="subtle"
                  className="border border-white/10 bg-white/[0.035] transition-[border-color,background-color,box-shadow] duration-300 focus-within:border-[#126BFF]/65 focus-within:bg-white/[0.06] focus-within:shadow-[0_0_0_3px_rgba(18,107,255,0.10)]"
                >
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your full name"
                    required
                    className="block w-full rounded-2xl bg-transparent px-4 py-3.5 text-base text-white outline-none placeholder:text-white/30"
                  />
                </LiquidLensSurface>
              </motion.div>

              {/* Email */}
              <motion.div
                variants={reduceMotion ? undefined : itemVariants}
              >
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-white/75"
                >
                  Email address
                </label>

                <LiquidLensSurface
                  radius={16}
                  intensity="subtle"
                  className="border border-white/10 bg-white/[0.035] transition-[border-color,background-color,box-shadow] duration-300 focus-within:border-[#126BFF]/65 focus-within:bg-white/[0.06] focus-within:shadow-[0_0_0_3px_rgba(18,107,255,0.10)]"
                >
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                    className="block w-full rounded-2xl bg-transparent px-4 py-3.5 text-base text-white outline-none placeholder:text-white/30"
                  />
                </LiquidLensSurface>
              </motion.div>

              {/* Password */}
              <motion.div
                variants={reduceMotion ? undefined : itemVariants}
              >
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-white/75"
                >
                  Password
                </label>

                <LiquidLensSurface
                  radius={16}
                  intensity="subtle"
                  className="border border-white/10 bg-white/[0.035] transition-[border-color,background-color,box-shadow] duration-300 focus-within:border-[#126BFF]/65 focus-within:bg-white/[0.06] focus-within:shadow-[0_0_0_3px_rgba(18,107,255,0.10)]"
                >
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      minLength={8}
                      required
                      className="block w-full rounded-2xl bg-transparent px-4 py-3.5 pr-14 text-base text-white outline-none placeholder:text-white/30"
                    />

                    <motion.button
                      type="button"
                      whileHover={
                        reduceMotion ? undefined : { scale: 1.08 }
                      }
                      whileTap={
                        reduceMotion ? undefined : { scale: 0.92 }
                      }
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      aria-pressed={showPassword}
                      className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-white/50 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#126BFF]/70"
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </motion.button>
                  </div>
                </LiquidLensSurface>

                <p className="mt-2 text-xs text-white/40">
                  Use at least 8 characters.
                </p>
              </motion.div>

              {/* Confirm password */}
              <motion.div
                variants={reduceMotion ? undefined : itemVariants}
              >
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm font-medium text-white/75"
                >
                  Confirm password
                </label>

                <LiquidLensSurface
                  radius={16}
                  intensity="subtle"
                  className={`border bg-white/[0.035] transition-[border-color,background-color,box-shadow] duration-300 focus-within:bg-white/[0.06] ${
                    confirmPassword && password !== confirmPassword
                      ? "border-red-400/50 focus-within:border-red-400/70 focus-within:shadow-[0_0_0_3px_rgba(248,113,113,0.08)]"
                      : confirmPassword && password === confirmPassword
                        ? "border-[#00C98B]/40 focus-within:border-[#00C98B]/60 focus-within:shadow-[0_0_0_3px_rgba(0,201,139,0.08)]"
                        : "border-white/10 focus-within:border-[#126BFF]/65 focus-within:shadow-[0_0_0_3px_rgba(18,107,255,0.10)]"
                  }`}
                >
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      placeholder="Enter your password again"
                      required
                      aria-invalid={
                        Boolean(confirmPassword) &&
                        password !== confirmPassword
                      }
                      className="block w-full rounded-2xl bg-transparent px-4 py-3.5 pr-14 text-base text-white outline-none placeholder:text-white/30"
                    />

                    <motion.button
                      type="button"
                      whileHover={
                        reduceMotion ? undefined : { scale: 1.08 }
                      }
                      whileTap={
                        reduceMotion ? undefined : { scale: 0.92 }
                      }
                      onClick={() =>
                        setShowConfirmPassword((value) => !value)
                      }
                      aria-label={
                        showConfirmPassword
                          ? "Hide confirm password"
                          : "Show confirm password"
                      }
                      aria-pressed={showConfirmPassword}
                      className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-white/50 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#126BFF]/70"
                    >
                      {showConfirmPassword ? (
                        <EyeOffIcon />
                      ) : (
                        <EyeIcon />
                      )}
                    </motion.button>
                  </div>
                </LiquidLensSurface>

                <AnimatePresence mode="wait" initial={false}>
                  {confirmPassword && (
                    <motion.p
                      key={
                        password === confirmPassword ? "match" : "mismatch"
                      }
                      initial={
                        reduceMotion ? false : { opacity: 0, y: -5 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      exit={
                        reduceMotion
                          ? undefined
                          : { opacity: 0, y: -4 }
                      }
                      transition={{ duration: 0.2 }}
                      className={`mt-2 text-xs ${
                        password === confirmPassword
                          ? "text-[#00C98B]"
                          : "text-red-300"
                      }`}
                    >
                      {password === confirmPassword
                        ? "Passwords match."
                        : "Passwords do not match."}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* API and validation messages */}
              <AnimatePresence initial={false}>
                {message && (
                  <motion.div
                    key="signup-error"
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
                    <div className="rounded-2xl border border-red-400/25 bg-red-400/[0.07] px-4 py-3 text-sm leading-6 text-red-300 backdrop-blur-xl">
                      {message}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <motion.div
                variants={reduceMotion ? undefined : itemVariants}
                className="pt-1"
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
                  className="relative w-full overflow-hidden rounded-2xl border border-white/20 bg-[#126BFF]/90 px-5 py-3.5 font-medium text-white shadow-[0_8px_30px_rgba(18,107,255,0.2)] backdrop-blur-xl transition-[background-color,box-shadow] duration-300 hover:bg-[#2477ff] hover:shadow-[0_0_35px_rgba(18,107,255,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7eb0ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080C16] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {!reduceMotion && !loading && (
                    <motion.span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-[-40%] w-1/3 skew-x-[-20deg] bg-white/15 blur-sm"
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

                    {loading ? "Creating account..." : "Create Account"}
                  </span>
                </motion.button>
              </motion.div>
            </motion.form>

            <motion.p
              variants={reduceMotion ? undefined : itemVariants}
              className="mt-6 text-center text-sm text-white/50"
            >
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-white transition-colors duration-300 hover:text-[#5d9bff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#126BFF]/70"
              >
                Log in
              </Link>
            </motion.p>

            <motion.p
              variants={reduceMotion ? undefined : itemVariants}
              className="mt-6 text-center text-xs leading-5 text-white/35"
            >
              By creating an account, you can manage your own professional
              portfolio through the platform.
            </motion.p>
          </div>
        </motion.section>
      </motion.div>
    </LiquidLensSurface>
  </motion.div>
</main>


);
}

function EyeIcon() {
return ( <svg
   viewBox="0 0 24 24"
   fill="none"
   stroke="currentColor"
   strokeWidth="1.8"
   className="h-5 w-5"
   aria-hidden="true"
 > <path
     strokeLinecap="round"
     strokeLinejoin="round"
     d="M2.25 12s3.75-6 9.75-6 9.75 6 9.75 6-3.75 6-9.75 6-9.75-6-9.75-6Z"
   /> <circle cx="12" cy="12" r="2.75" /> </svg>
);
}

function EyeOffIcon() {
return ( <svg
   viewBox="0 0 24 24"
   fill="none"
   stroke="currentColor"
   strokeWidth="1.8"
   className="h-5 w-5"
   aria-hidden="true"
 > <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" /> <path
     strokeLinecap="round"
     strokeLinejoin="round"
     d="M10.58 10.58A2 2 0 0 0 13.42 13.42"
   /> <path
     strokeLinecap="round"
     strokeLinejoin="round"
     d="M9.88 5.24A10.75 10.75 0 0 1 12 5c6 0 9.75 7 9.75 7a18.25 18.25 0 0 1-3.1 3.91"
   /> <path
     strokeLinecap="round"
     strokeLinejoin="round"
     d="M6.61 6.61C4.05 8.22 2.25 12 2.25 12a18.25 18.25 0 0 0 4.67 4.88A10.66 10.66 0 0 0 12 19c1.2 0 2.3-.22 3.3-.58"
   /> </svg>
);
}
