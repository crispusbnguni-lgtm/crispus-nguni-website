"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";

type PhoneOtpPanelProps = {
  intent: "signup" | "signin";
};

export function PhoneOtpPanel({ intent }: PhoneOtpPanelProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const signingUp = intent === "signup";

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(`/api/auth/phone/${intent}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ phone, ...(signingUp ? { name } : {}) }),
      });
      const data = await response.json();
      if (!response.ok || typeof data.challengeId !== "string") {
        setMessage(data.message || "We could not start phone verification.");
        return;
      }
      setChallengeId(data.challengeId);
      setCode("");
      setMessage(data.message || "If this number is eligible, a code has been sent.");
    } catch {
      setMessage("We could not start phone verification. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !challengeId) return;
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(`/api/auth/phone/${intent}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ challengeId, code }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setMessage(data.message || "That code is invalid or expired.");
        return;
      }
      if (data.pending === "enrollment") {
        router.replace("/mfa/enroll");
      } else if (data.pending === "mfa") {
        router.replace("/mfa/challenge");
      } else {
        router.replace("/dashboard");
      }
    } catch {
      setMessage("We could not verify that code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby={`phone-otp-${intent}-title`}
      className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.16)] backdrop-blur-xl sm:p-5"
    >
      <div className="mb-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#D9A441]">
          Phone verification
        </p>
        <h3
          id={`phone-otp-${intent}-title`}
          className="mt-1 text-lg font-semibold text-white"
        >
          {signingUp ? "Create an account with your phone" : "Sign in with your phone"}
        </h3>
        <p className="mt-1 text-sm leading-6 text-white/50">
          Enter your number with country code. We’ll send a one-time SMS code.
        </p>
      </div>

      {!challengeId ? (
        <form onSubmit={sendCode} className="space-y-3">
          {signingUp && (
            <div>
              <label
                htmlFor={`phone-signup-name`}
                className="mb-1.5 block text-sm font-medium text-white/75"
              >
                Full name
              </label>
              <LiquidLensSurface
                radius={14}
                intensity="subtle"
                className="border border-white/10 bg-white/[0.035] focus-within:border-[#126BFF]/65"
              >
                <input
                  id="phone-signup-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  maxLength={100}
                  required
                  className="w-full rounded-2xl bg-transparent px-4 py-3 text-base text-white outline-none placeholder:text-white/30"
                  placeholder="Your full name"
                />
              </LiquidLensSurface>
            </div>
          )}
          <div>
            <label
              htmlFor={`phone-${intent}-number`}
              className="mb-1.5 block text-sm font-medium text-white/75"
            >
              Phone number
            </label>
            <LiquidLensSurface
              radius={14}
              intensity="subtle"
              className="border border-white/10 bg-white/[0.035] focus-within:border-[#126BFF]/65"
            >
              <input
                id={`phone-${intent}-number`}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+254 712 345 678"
                maxLength={40}
                required
                className="w-full rounded-2xl bg-transparent px-4 py-3 text-base text-white outline-none placeholder:text-white/30"
              />
            </LiquidLensSurface>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center rounded-2xl border border-[#5d9bff]/35 bg-[#126BFF]/15 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#126BFF]/25 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {busy ? "Sending code…" : "Send SMS code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-3">
          <p className="text-sm text-white/60">
            Enter the code sent to <span className="text-white/85">{phone}</span>.
          </p>
          <div>
            <label
              htmlFor={`phone-${intent}-code`}
              className="mb-1.5 block text-sm font-medium text-white/75"
            >
              Verification code
            </label>
            <LiquidLensSurface
              radius={14}
              intensity="subtle"
              className="border border-white/10 bg-white/[0.035] focus-within:border-[#126BFF]/65"
            >
              <input
                id={`phone-${intent}-code`}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{4,10}"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="Enter your code"
                required
                className="w-full rounded-2xl bg-transparent px-4 py-3 text-base tracking-[0.2em] text-white outline-none placeholder:tracking-normal placeholder:text-white/30"
              />
            </LiquidLensSurface>
          </div>
          <button
            type="submit"
            disabled={busy || code.length < 4}
            className="flex w-full items-center justify-center rounded-2xl border border-[#5d9bff]/35 bg-[#126BFF]/15 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#126BFF]/25 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {busy ? "Verifying…" : signingUp ? "Verify and create account" : "Verify and sign in"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setChallengeId("");
              setCode("");
              setMessage("");
            }}
            className="w-full rounded-xl px-3 py-2 text-sm text-white/55 transition-colors hover:text-white disabled:opacity-50"
          >
            Use a different number or resend a code
          </button>
        </form>
      )}

      {message && (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 rounded-xl border border-[#5d9bff]/20 bg-[#126BFF]/[0.08] px-3 py-2.5 text-sm leading-6 text-blue-100/90"
        >
          {message}
        </p>
      )}
    </section>
  );
}
