"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";

export default function MagicLinkClient({
  token,
}: {
  token: string;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
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

  async function handleSignIn() {
    if (!token || loading || signedIn) return;

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/magic-link/verify", {
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
            "This sign-in link is invalid, expired or has already been used. Request a new link.",
        );
        return;
      }

      if (data.pending === "enrollment") {
        router.replace("/mfa/enroll");
      } else if (data.pending === "mfa") {
        router.replace("/mfa/challenge");
      } else {
        setSignedIn(true);
        setMessage(data.message || "You are now signed in securely.");
      }
    } catch {
      setMessage(
        "We could not complete sign-in. Check your connection and try again.",
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
                {signedIn ? (
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
                      d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5m5 5H3"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>

              <p className="mt-8 text-xs font-semibold uppercase tracking-[0.3em] text-[#D9A441]">
                Secure sign-in
              </p>

              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                {signedIn ? "You're signed in" : "Complete your sign-in"}
              </h1>

              <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-white/60 sm:text-base">
                {signedIn
                  ? "Your secure sign-in is complete. You can now continue to your dashboard."
                  : "Confirm below to use your one-time sign-in link and access your Crispus Nguni account."}
              </p>

              {message && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`mt-7 rounded-2xl border px-4 py-3 text-sm leading-6 ${
                    signedIn
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
                  This sign-in link is missing or invalid. Return to sign-in and request a new link.
                </div>
              )}

              {!signedIn && (
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={!token || loading}
                  className="mt-9 inline-flex min-h-13 w-full items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-r from-[#126BFF] to-[#5145CD] px-6 py-4 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(18,107,255,0.22)] transition-all duration-300 hover:brightness-110 hover:shadow-[0_15px_40px_rgba(18,107,255,0.32)] disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-sm"
                >
                  {loading ? "Signing you in..." : "Continue securely"}
                </button>
              )}

              {signedIn && (
                <button
                  type="button"
                  onClick={() => router.replace("/dashboard")}
                  className="mt-9 inline-flex min-h-13 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#126BFF] to-[#5145CD] px-6 py-4 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(18,107,255,0.22)] transition-all hover:brightness-110 sm:max-w-sm"
                >
                  Continue to dashboard
                </button>
              )}

              <p className="mt-8 text-xs leading-6 text-white/35">
                This link expires after 15 minutes and can only be used once. Never forward it to anyone.
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
