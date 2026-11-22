"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";

export default function VerificationClient({
  token,
}: {
  token: string;
}) {
  const reduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const currentUrl = new URL(window.location.href);

    if (!currentUrl.searchParams.has("token")) return;

    currentUrl.searchParams.delete("token");
    window.history.replaceState(
      window.history.state,
      "",
      `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
    );
  }, []);

  async function handleVerification() {
    if (!token || loading || verified) return;

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok || data.success !== true) {
        setMessage(
          data.message ||
            "We could not verify this link. Request a new verification email if necessary.",
        );
        return;
      }

      setVerified(true);
      setMessage(data.message);
    } catch {
      setMessage(
        "We could not complete verification. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative isolate flex min-h-[100svh] w-full items-center justify-center overflow-hidden px-4 py-10 text-white sm:px-6">
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed -right-32 -top-32 h-96 w-96 rounded-full bg-[#126BFF]/20 blur-[110px]"
        animate={
          reduceMotion
            ? undefined
            : {
                x: [0, 18, 0],
                y: [0, 15, 0],
                scale: [1, 1.08, 1],
              }
        }
        transition={{
          duration: 14,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed -bottom-32 -left-32 h-96 w-96 rounded-full bg-[#722BFF]/20 blur-[110px]"
        animate={
          reduceMotion
            ? undefined
            : {
                x: [0, -18, 0],
                y: [0, -15, 0],
                scale: [1, 1.08, 1],
              }
        }
        transition={{
          duration: 16,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.65 }}
        className="relative z-10 w-full max-w-xl"
      >
        <LiquidLensSurface
          radius={30}
          intensity="strong"
          className="overflow-hidden border border-white/15 bg-[#080C16]/70 text-white shadow-[0_25px_100px_rgba(0,0,0,0.4)] backdrop-blur-2xl"
        >
          <div className="relative overflow-hidden px-6 py-12 text-center sm:px-12 sm:py-16">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(18,107,255,0.16),transparent_65%)]"
            />

            <div className="relative z-10">
              <Link
                href="/"
                className="inline-flex text-2xl font-semibold tracking-tight"
              >
                Crispus<span className="text-[#126BFF]">.</span>
              </Link>

              <div className="mx-auto mt-10 flex h-20 w-20 items-center justify-center rounded-full border border-[#126BFF]/30 bg-[#126BFF]/10 shadow-[0_0_45px_rgba(18,107,255,0.15)]">
                {verified ? (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-9 w-9 text-emerald-400"
                  >
                    <path
                      d="m5 12 4.5 4.5L19 7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-9 w-9 text-[#5D9BFF]"
                  >
                    <path
                      d="M3 7.5 12 14l9-6.5M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>

              <p className="mt-8 text-xs font-semibold uppercase tracking-[0.3em] text-[#D9A441]">
                Account security
              </p>

              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                {verified
                  ? "Email verified"
                  : "Verify your email"}
              </h1>

              <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-white/60 sm:text-base">
                {verified
                  ? "Your email address is now verified. Your account is ready for sign-in."
                  : "One final step before you get started. Confirm that you own this email address to activate your account."}
              </p>

              {message && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`mt-7 rounded-2xl border px-4 py-3 text-sm leading-6 ${
                    verified
                      ? "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200"
                      : "border-red-400/20 bg-red-400/[0.08] text-red-200"
                  }`}
                >
                  {message}
                </div>
              )}

              {!token && (
                <div
                  role="alert"
                  className="mt-7 rounded-2xl border border-amber-400/20 bg-amber-400/[0.08] px-4 py-3 text-sm leading-6 text-amber-200"
                >
                  This verification link is missing or invalid. Please request a new verification email.
                </div>
              )}

              {!verified && (
                <button
                  type="button"
                  onClick={handleVerification}
                  disabled={!token || loading}
                  className="mt-9 inline-flex min-h-13 w-full items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-r from-[#126BFF] to-[#5145CD] px-6 py-4 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(18,107,255,0.22)] transition-all duration-300 hover:brightness-110 hover:shadow-[0_15px_40px_rgba(18,107,255,0.32)] disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-sm"
                >
                  {loading
                    ? "Verifying your email..."
                    : "Verify email address"}
                </button>
              )}

              {verified && (
                <Link
                  href="/login"
                  className="mt-9 inline-flex min-h-13 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#126BFF] to-[#5145CD] px-6 py-4 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(18,107,255,0.22)] transition-all hover:brightness-110 sm:max-w-sm"
                >
                  Continue to sign in
                </Link>
              )}

              <p className="mt-8 text-xs leading-6 text-white/35">
                Your security matters. Verification links expire after 30 minutes and can only be used once.
              </p>

              <div className="mt-8 border-t border-white/10 pt-6">
                <Link
                  href="/login"
                  className="text-sm text-white/55 transition-colors hover:text-white"
                >
                  Return to sign in
                </Link>
              </div>
            </div>
          </div>
        </LiquidLensSurface>
      </motion.div>
    </main>
  );
}
