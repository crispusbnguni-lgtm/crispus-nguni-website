
"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Clipboard,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";
import WelcomePageBackground from "@/components/welcome-page/WelcomePageBackground";

type Props = {
  backgroundImage: string;
  backgroundColor: string;
  backgroundPosition?: string;
};

type EnrollmentSetup = {
  qrCodeDataUrl: string;
  manualSetupKey: string;
  expiresAt: string;
};

type Confirmation = { recoveryCodes: string[] };

export default function MfaEnrollmentPage({
  backgroundImage,
  backgroundColor,
  backgroundPosition,
}: Props) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [setup, setSetup] = useState<EnrollmentSetup | null>(null);
  const [starting, setStarting] = useState(true);
  const [code, setCode] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [message, setMessage] = useState("");
  const [expired, setExpired] = useState(false);
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSetup() {
      try {
        const response = await fetch("/api/auth/mfa/enrollment/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify({}),
        });

        const data: unknown = await response.json();

        if (!response.ok || !isSetup(data)) {
          setExpired(response.status === 401);
          setMessage(
            response.status === 401
              ? "This setup authorization has expired or was already used. Sign in again to continue."
              : "Secure setup is temporarily unavailable. Please try again.",
          );
          return;
        }

        setSetup(data);
        setSecondsLeft(
          Math.max(
            0,
            Math.floor((Date.parse(data.expiresAt) - Date.now()) / 1000),
          ),
        );
      } catch {
        if (!controller.signal.aborted) {
          setMessage(
            "We could not load secure setup. Check your connection and try again.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setStarting(false);
        }
      }
    }

    void loadSetup();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!setup || confirmation) return;

    const timer = window.setInterval(() => {
      const left = Math.max(
        0,
        Math.floor((Date.parse(setup.expiresAt) - Date.now()) / 1000),
      );

      setSecondsLeft(left);

      if (left === 0) {
        setExpired(true);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [setup, confirmation]);

  async function confirmEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (confirming || !setup || expired || code.length < 6) return;

    setConfirming(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/mfa/enrollment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ code }),
      });

      const data: unknown = await response.json();

      if (isConfirmation(data) && response.ok && data.success === true) {
        setConfirmation({ recoveryCodes: data.recoveryCodes });
        setSetup(null);
        setCode("");
        setMessage("");
        return;
      }

      const result = isRecord(data) ? data : {};

      if (
        response.status === 401 ||
        (typeof result.message === "string" &&
          result.message.toLowerCase().includes("expired"))
      ) {
        setExpired(true);
        setMessage(
          "This setup authorization expired or was already used. Sign in again to restart setup.",
        );
      } else {
        setMessage(
          typeof result.message === "string"
            ? result.message
            : "That authenticator code was not accepted. Check the code and try again.",
        );
      }
    } catch {
      setMessage(
        "We could not confirm setup. Check your connection and try again.",
      );
    } finally {
      setConfirming(false);
    }
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setMessage(`${label} copied. Keep it somewhere private.`);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setMessage(
        `Copy was unavailable. Select and copy the ${label.toLowerCase()} manually.`,
      );
    }
  }

  return (
    <main className="relative isolate flex min-h-[100svh] items-center justify-center overflow-x-clip px-4 py-8 text-white sm:px-6 sm:py-12">
      <WelcomePageBackground
        backgroundImage={backgroundImage}
        backgroundColor={backgroundColor}
        backgroundPosition={backgroundPosition}
      />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.45 }}
        className="relative z-10 w-full max-w-3xl"
      >
        <LiquidLensSurface
          radius={30}
          intensity="strong"
          className="overflow-hidden border border-white/15 bg-[#080C16]/70 shadow-[0_25px_100px_rgba(0,0,0,0.4)]"
        >
          <div className="relative p-5 sm:p-8 md:p-10">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(18,107,255,0.12),transparent_55%)]"
            />

            <div className="relative">
              <Link
                href="/login"
                className="text-sm text-white/55 transition hover:text-white"
              >
                ← Return to sign in
              </Link>

              <div className="mt-7 flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[#5d9bff]/25 bg-[#126BFF]/10 text-[#9fc1ff]">
                  <ShieldCheck aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D9A441]">
                    Secure account setup
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                    Set up your authenticator
                  </h1>
                </div>
              </div>

              {!confirmation ? (
                <>
                  <p className="mt-5 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">
                    An additional sign-in check is required for this account.
                    Connect an authenticator app, then verify a current code to
                    finish enrollment.
                  </p>

                  <AnimatePresence mode="wait">
                    {starting ? (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="mt-8 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-sm text-white/65"
                      >
                        <LoaderCircle
                          className="h-5 w-5 animate-spin text-[#8ab5ff]"
                          aria-hidden="true"
                        />
                        Preparing your private setup details…
                      </motion.div>
                    ) : setup ? (
                      <motion.div
                        key="setup"
                        initial={
                          reduceMotion ? false : { opacity: 0, y: 8 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-7 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
                      >
                        <section className="rounded-3xl border border-white/10 bg-black/20 p-4 sm:p-5">
                          <h2 className="flex items-center gap-2 text-sm font-semibold">
                            <Smartphone
                              className="h-4 w-4 text-[#8ab5ff]"
                              aria-hidden="true"
                            />
                            1. Connect your app
                          </h2>

                          <p className="mt-2 text-sm leading-6 text-white/55">
                            Scan this QR code with your authenticator app. Keep
                            the setup screen private.
                          </p>

                          <div className="mx-auto mt-5 grid aspect-square w-full max-w-[250px] place-items-center rounded-2xl bg-white p-3">
                            <Image
                              src={setup.qrCodeDataUrl}
                              alt="Authenticator setup QR code"
                              width={250}
                              height={250}
                              unoptimized
                              className="h-full w-full object-contain"
                            />
                          </div>

                          <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                            <summary className="cursor-pointer text-sm font-medium text-white/80">
                              Can’t scan the QR code?
                            </summary>

                            <p className="mt-3 text-xs leading-5 text-white/50">
                              Enter this key manually in your authenticator
                              app. Anyone with this key can generate sign-in
                              codes, so do not share it.
                            </p>

                            <code className="mt-2 block break-all rounded-xl bg-black/30 px-3 py-2 font-mono text-sm tracking-wider text-[#d7e6ff]">
                              {setup.manualSetupKey}
                            </code>

                            <button
                              type="button"
                              onClick={() =>
                                void copyText(
                                  setup.manualSetupKey,
                                  "Setup key",
                                )
                              }
                              className="mt-2 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-[#a9c8ff] hover:bg-white/5"
                            >
                              <Clipboard
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              Copy setup key
                            </button>
                          </details>
                        </section>

                        <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
                          <h2 className="flex items-center gap-2 text-sm font-semibold">
                            <LockKeyhole
                              className="h-4 w-4 text-[#D9A441]"
                              aria-hidden="true"
                            />
                            2. Verify and activate
                          </h2>

                          <p className="mt-2 text-sm leading-6 text-white/55">
                            Enter the six-digit code shown by your app. The
                            factor becomes active only after the server
                            verifies it.
                          </p>

                          <form
                            onSubmit={confirmEnrollment}
                            className="mt-5 space-y-4"
                          >
                            <div>
                              <label
                                htmlFor="totp-enrollment-code"
                                className="mb-2 block text-sm font-medium text-white/80"
                              >
                                Authenticator code
                              </label>

                              <input
                                id="totp-enrollment-code"
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                pattern="[0-9]{6,8}"
                                maxLength={8}
                                value={code}
                                onChange={(event) =>
                                  setCode(
                                    event.target.value
                                      .replace(/\D/g, "")
                                      .slice(0, 8),
                                  )
                                }
                                required
                                disabled={expired || confirming}
                                className="w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3.5 text-center font-mono text-xl tracking-[0.35em] text-white outline-none transition focus:border-[#5d9bff]/70 focus:ring-2 focus:ring-[#126BFF]/20 disabled:opacity-50"
                                placeholder="000000"
                              />
                            </div>

                            <p className="text-xs text-white/45">
                              {expired
                                ? "Setup authorization expired."
                                : `Setup authorization expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}.`}
                            </p>

                            <button
                              type="submit"
                              disabled={
                                !setup ||
                                expired ||
                                confirming ||
                                code.length < 6
                              }
                              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#8ab5ff]/35 bg-gradient-to-r from-[#126BFF] to-[#5145CD] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(18,107,255,0.2)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {confirming && (
                                <LoaderCircle
                                  className="h-4 w-4 animate-spin"
                                  aria-hidden="true"
                                />
                              )}
                              {confirming
                                ? "Verifying code…"
                                : "Verify and enable MFA"}
                            </button>
                          </form>

                          <div className="mt-5 rounded-2xl border border-white/8 bg-black/15 p-3 text-xs leading-5 text-white/45">
                            Your setup secret is delivered only to this
                            restricted enrollment flow. If setup expires, sign
                            in again to obtain a new authorization.
                          </div>
                        </section>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="expired"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-200/[0.06] p-5"
                      >
                        <h2 className="font-semibold text-amber-100">
                          Setup needs to be restarted
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-white/60">
                          {message ||
                            "This enrollment authorization is no longer valid."}
                        </p>

                        <Link
                          href="/login"
                          className="mt-4 inline-flex rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/5"
                        >
                          Return to sign in
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {message && setup && (
                    <p
                      role="alert"
                      aria-live="polite"
                      className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-100"
                    >
                      {message}
                    </p>
                  )}
                </>
              ) : (
                <motion.section
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 rounded-3xl border border-emerald-300/20 bg-emerald-200/[0.045] p-5 sm:p-7"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-200">
                      <Check aria-hidden="true" />
                    </span>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/70">
                        Authenticator confirmed
                      </p>
                      <h2 className="mt-1 text-xl font-semibold text-white">
                        Save your recovery codes
                      </h2>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-white/65">
                    These codes are shown once. Store them somewhere private
                    and separate from this device. Each code can be used for
                    one sign-in if your authenticator is unavailable.
                  </p>

                  <div
                    className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/25 p-3 sm:grid-cols-2 sm:gap-3 sm:p-4"
                    aria-label="One-time recovery codes"
                  >
                    {confirmation.recoveryCodes.map((recoveryCode) => (
                      <code
                        key={recoveryCode}
                        className="rounded-xl bg-white/[0.045] px-2 py-2.5 text-center font-mono text-sm tracking-wider text-white/90"
                      >
                        {recoveryCode}
                      </code>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() =>
                        void copyText(
                          confirmation.recoveryCodes.join("\n"),
                          "Recovery codes",
                        )
                      }
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.045] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                    >
                      <Clipboard className="h-4 w-4" aria-hidden="true" />
                      {copied ? "Copied" : "Copy recovery codes"}
                    </button>

                    <button
                      type="button"
                      onClick={() => router.replace("/dashboard")}
                      className="min-h-11 flex-1 rounded-2xl bg-gradient-to-r from-[#126BFF] to-[#5145CD] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(18,107,255,0.18)] transition hover:brightness-110"
                    >
                      I’ve saved them — continue
                    </button>
                  </div>

                  <p
                    role="status"
                    aria-live="polite"
                    className="mt-3 min-h-5 text-xs text-white/50"
                  >
                    {message}
                  </p>
                </motion.section>
              )}
            </div>
          </div>
        </LiquidLensSurface>
      </motion.div>
    </main>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isSetup(
  value: unknown,
): value is EnrollmentSetup & { success: true } {
  return (
    isRecord(value) &&
    value.success === true &&
    typeof value.qrCodeDataUrl === "string" &&
    value.qrCodeDataUrl.startsWith("data:image/png;base64,") &&
    typeof value.manualSetupKey === "string" &&
    /^[A-Z2-7]{20,64}$/.test(value.manualSetupKey) &&
    typeof value.expiresAt === "string" &&
    Number.isFinite(Date.parse(value.expiresAt))
  );
}

function isConfirmation(
  value: unknown,
): value is { success?: boolean; recoveryCodes: string[] } {
  return (
    isRecord(value) &&
    Array.isArray(value.recoveryCodes) &&
    value.recoveryCodes.length > 0 &&
    value.recoveryCodes.every((item) => typeof item === "string")
  );
}
