"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { KeyRound, LoaderCircle, ShieldCheck, Smartphone } from "lucide-react";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";

type ChallengeMethod = "totp" | "recovery";

export default function MfaChallengePage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [method, setMethod] = useState<ChallengeMethod>("totp");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [expired, setExpired] = useState(false);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || expired || !code.trim()) return;
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/mfa/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ code: code.trim() }),
      });
      const value: unknown = await response.json();
      const result = isRecord(value) ? value : {};
      if (response.ok && result.success === true) {
        router.replace("/dashboard");
        return;
      }
      if (typeof result.attemptsRemaining === "number") {
        setCode("");
        setMessage(`That ${method === "totp" ? "authenticator" : "recovery"} code was not accepted. ${result.attemptsRemaining} attempt${result.attemptsRemaining === 1 ? "" : "s"} remain before this challenge expires.`);
      } else if (response.status === 401) {
        setExpired(true);
        setMessage("This sign-in challenge has expired or was already used. Sign in again to start a new challenge.");
      } else {
        setMessage(typeof result.message === "string" ? result.message : "Secure verification is temporarily unavailable. Please try again.");
      }
    } catch {
      setMessage("We could not verify your code. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative isolate flex min-h-[100svh] items-center justify-center overflow-x-clip px-4 py-8 text-white sm:px-6 sm:py-12">
      <div aria-hidden="true" className="pointer-events-none fixed -right-36 -top-10 h-96 w-96 rounded-full bg-[#126BFF]/20 blur-[110px]" />
      <div aria-hidden="true" className="pointer-events-none fixed -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-[#722BFF]/15 blur-[120px]" />
      <motion.div initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.45 }} className="relative z-10 w-full max-w-xl">
        <LiquidLensSurface radius={30} intensity="strong" className="overflow-hidden border border-white/15 bg-[#080C16]/70 shadow-[0_25px_100px_rgba(0,0,0,0.4)]">
          <div className="relative p-5 sm:p-8 md:p-10">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(81,69,205,0.16),transparent_60%)]" />
            <div className="relative">
              <Link href="/login" className="text-sm text-white/55 transition hover:text-white">← Return to sign in</Link>
              <div className="mt-8 flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[#5d9bff]/25 bg-[#126BFF]/10 text-[#9fc1ff]"><ShieldCheck aria-hidden="true" /></span>
                <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D9A441]">Identity verification</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Confirm it’s you</h1></div>
              </div>
              <p className="mt-5 text-sm leading-7 text-white/60">Enter a current code from your authenticator app, or use one unused recovery code. Your session will be created only after the server confirms the code.</p>

              <div className="mt-7 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-1.5" role="group" aria-label="Choose a verification method">
                <button type="button" aria-pressed={method === "totp"} disabled={expired || submitting} onClick={() => { setMethod("totp"); setCode(""); setMessage(""); }} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${method === "totp" ? "bg-white/10 text-white shadow-inner" : "text-white/50 hover:text-white/80"}`}><Smartphone className="h-4 w-4" aria-hidden="true" /> Authenticator</button>
                <button type="button" aria-pressed={method === "recovery"} disabled={expired || submitting} onClick={() => { setMethod("recovery"); setCode(""); setMessage(""); }} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${method === "recovery" ? "bg-white/10 text-white shadow-inner" : "text-white/50 hover:text-white/80"}`}><KeyRound className="h-4 w-4" aria-hidden="true" /> Recovery code</button>
              </div>

              <form onSubmit={verify} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="mfa-login-code" className="mb-2 block text-sm font-medium text-white/80">{method === "totp" ? "Authenticator code" : "Unused recovery code"}</label>
                  <input id="mfa-login-code" type="text" inputMode={method === "totp" ? "numeric" : "text"} autoComplete={method === "totp" ? "one-time-code" : "off"} value={code} onChange={(event) => setCode(method === "totp" ? event.target.value.replace(/\D/g, "").slice(0, 8) : event.target.value.slice(0, 32))} required disabled={expired || submitting} placeholder={method === "totp" ? "000000" : "ABCD-EFGH-IJKL"} className="w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3.5 text-center font-mono text-lg tracking-[0.22em] text-white outline-none transition focus:border-[#5d9bff]/70 focus:ring-2 focus:ring-[#126BFF]/20 disabled:opacity-50" />
                </div>
                {message && <p role={expired ? "alert" : "status"} aria-live="polite" className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${expired ? "border-amber-300/20 bg-amber-200/[0.06] text-amber-100" : "border-rose-300/20 bg-rose-300/[0.06] text-rose-100"}`}>{message}</p>}
                <button type="submit" disabled={expired || submitting || !code.trim()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#8ab5ff]/35 bg-gradient-to-r from-[#126BFF] to-[#5145CD] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(18,107,255,0.2)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45">{submitting && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}{submitting ? "Verifying securely…" : "Verify and continue"}</button>
              </form>
              <p className="mt-5 text-center text-xs leading-5 text-white/40">This challenge is short-lived and can be completed only once. If it expires, return to sign in and authenticate again.</p>
            </div>
          </div>
        </LiquidLensSurface>
      </motion.div>
    </main>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
