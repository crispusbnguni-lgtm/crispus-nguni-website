"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";

type RequestState = "form" | "success";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<RequestState>("form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();
    if (
      !normalizedEmail ||
      normalizedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      setError("Enter a valid email address and try again.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const result: unknown = await response.json().catch(() => null);
      const message =
        result &&
        typeof result === "object" &&
        "message" in result &&
        typeof result.message === "string"
          ? result.message
          : "";

      if (response.ok) {
        setEmail(normalizedEmail);
        setState("success");
      } else if (response.status === 429) {
        setError(message || "Too many requests. Please wait before trying again.");
      } else if (response.status === 503) {
        setError(
          message ||
            "Password reset is temporarily unavailable. Please try again shortly.",
        );
      } else if (response.status === 400) {
        setError(message || "Enter a valid email address and try again.");
      } else {
        setError("We could not process your request. Please try again shortly.");
      }
    } catch {
      setError("We could not reach the service. Please try again shortly.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const cardStyle = {
    background: "var(--surface)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    boxShadow: "0 24px 80px rgba(0, 0, 0, 0.24)",
  };

  const inputSurfaceStyle = {
    background: "var(--surface-solid)",
    color: "var(--text)",
    border: "1px solid var(--border)",
  };

  return (
    <main className="flex min-h-[100svh] items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center justify-between gap-4 px-1">
          <Link
            href="/"
            className="text-2xl font-semibold tracking-tight text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
          >
            Crispus<span className="text-[#126BFF]">.</span>
          </Link>
          <Link
            href="/login"
            className="text-sm text-[var(--text)] underline decoration-[var(--accent)] underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
          >
            Back to sign in
          </Link>
        </div>

        <LiquidLensSurface
          intensity="strong"
          radius={28}
          className="overflow-hidden"
          style={cardStyle}
        >
          <section className="p-6 sm:p-9" aria-labelledby="forgot-password-title">
            {state === "success" ? (
              <div role="status" aria-live="polite" className="space-y-6">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] text-xl text-[var(--accent)]"
                  aria-hidden="true"
                >
                  ✓
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Account recovery
                  </p>
                  <h1
                    id="forgot-password-title"
                    className="text-3xl font-semibold tracking-tight sm:text-4xl"
                  >
                    Check your email
                  </h1>
                  <p className="text-sm leading-6 text-[var(--text-muted)]">
                    If an account can proceed with password recovery, further
                    instructions will be communicated by email.
                  </p>
                  <p className="break-all text-sm font-medium text-[var(--text)]">
                    {email}
                  </p>
                </div>
                <div className="flex flex-col gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setState("form")}
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-[var(--border)] px-5 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-solid)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    Return to the form
                  </button>
                  <Link
                    href="/login"
                    className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text)]"
                  >
                    Back to sign in
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-8 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Account recovery
                  </p>
                  <h1
                    id="forgot-password-title"
                    className="text-3xl font-semibold tracking-tight sm:text-4xl"
                  >
                    Forgot your password?
                  </h1>
                  <p className="text-sm leading-6 text-[var(--text-muted)]">
                    Enter the email address associated with your account. If
                    password recovery can proceed, further instructions will be
                    communicated by email.
                  </p>
                </div>

                <form className="space-y-5" onSubmit={handleSubmit} noValidate>
                  <div className="space-y-2">
                    <label
                      htmlFor="recovery-email"
                      className="text-sm font-medium text-[var(--text)]"
                    >
                      Email address
                    </label>
                    <LiquidLensSurface
                      intensity="subtle"
                      radius={14}
                      className="overflow-hidden focus-within:ring-2 focus-within:ring-[var(--accent)]"
                      style={inputSurfaceStyle}
                    >
                      <input
                        id="recovery-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        maxLength={254}
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        aria-invalid={error.toLowerCase().includes("valid email")}
                        aria-describedby={error ? "recovery-error" : undefined}
                        className="min-h-12 w-full bg-transparent px-4 text-sm outline-none placeholder:text-[var(--text-muted)]"
                        placeholder="you@example.com"
                      />
                    </LiquidLensSurface>
                  </div>

                  {error && (
                    <p
                      id="recovery-error"
                      role="alert"
                      aria-live="assertive"
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-4 py-3 text-sm text-[var(--text)]"
                    >
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text)] disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    {isSubmitting ? "Sending request…" : "Continue"}
                  </button>
                </form>

                <p className="mt-7 text-center text-sm text-[var(--text-muted)]">
                  Remember your password?{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-[var(--text)] underline decoration-[var(--accent)] underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
                  >
                  Back to sign in
                  </Link>
                </p>
              </>
            )}
          </section>
        </LiquidLensSurface>
        <div className="mt-5 flex items-center justify-between gap-4 px-1 text-xs">
          <Link
            href="/"
            className="text-[var(--text)]/70 transition-colors hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
          >
            Back to website
          </Link>
          <span className="text-[var(--text)]/70">Secure account recovery</span>
        </div>
      </div>
    </main>
  );
}
