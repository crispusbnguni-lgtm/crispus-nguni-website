
"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";

type PageState = "checking" | "form" | "success" | "invalid";

export default function ResetPasswordPage() {
  const [pageState, setPageState] = useState<PageState>("checking");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const hasCapturedToken = useRef(false);

  useEffect(() => {
    if (hasCapturedToken.current) return;
    hasCapturedToken.current = true;

    const currentUrl = new URL(window.location.href);
    const submittedToken = currentUrl.searchParams.get("token") ?? "";
    setToken(submittedToken);

    if (currentUrl.searchParams.has("token")) {
      currentUrl.searchParams.delete("token");
      window.history.replaceState(
        window.history.state,
        "",
        `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
      );
    }

    setPageState(
      /^[A-Za-z0-9_-]{43}$/.test(submittedToken) ? "form" : "invalid",
    );
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8 || password.length > 1024) {
      setError("Your password must be between 8 and 1024 characters.");
      return;
    }

    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ token, password }),
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
        setPassword("");
        setConfirmation("");
        setToken("");
        setPageState("success");
      } else if (response.status === 400) {
        setToken("");
        setPageState("invalid");
      } else if (response.status === 429 || response.status === 503) {
        setError(
          message ||
            (response.status === 429
              ? "Too many attempts. Please try again later."
              : "Password reset is temporarily unavailable. Please try again shortly."),
        );
      } else {
        setError(
          "We could not process your request. Please try again shortly.",
        );
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
          <section
            className="p-6 sm:p-9"
            aria-labelledby="reset-password-title"
          >
            {pageState === "checking" ? (
              <div role="status" aria-live="polite" className="space-y-3 py-8">
                <h1 id="reset-password-title" className="text-2xl font-semibold">
                  Checking your reset link
                </h1>
                <p className="text-sm text-[var(--text-muted)]">
                  Please wait while we prepare the password form.
                </p>
              </div>
            ) : pageState === "success" ? (
              <div role="status" aria-live="polite" className="space-y-6">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] text-xl text-[var(--accent)]"
                  aria-hidden="true"
                >
                  ✓
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Password updated
                  </p>

                  <h1
                    id="reset-password-title"
                    className="text-3xl font-semibold tracking-tight"
                  >
                    You’re all set
                  </h1>

                  <p className="text-sm leading-6 text-[var(--text-muted)]">
                    Your password has been reset. Log in using your new password.
                  </p>
                </div>

                <Link
                  href="/login"
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text)]"
                >
                  Back to sign in
                </Link>
              </div>
            ) : pageState === "invalid" ? (
              <div role="status" aria-live="polite" className="space-y-6">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Account recovery
                  </p>

                  <h1
                    id="reset-password-title"
                    className="text-3xl font-semibold tracking-tight"
                  >
                    This link can’t be used
                  </h1>

                  <p className="text-sm leading-6 text-[var(--text-muted)]">
                    This password reset link is invalid or has expired. You can
                    request a new one to continue.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <Link
                    href="/forgot-password"
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text)]"
                  >
                    Request a new link
                  </Link>

                  <Link
                    href="/login"
                    className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--border)] px-5 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-solid)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
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
                    id="reset-password-title"
                    className="text-3xl font-semibold tracking-tight sm:text-4xl"
                  >
                    Choose a new password
                  </h1>

                  <p className="text-sm leading-6 text-[var(--text-muted)]">
                    Use a password between 8 and 1024 characters. Your password
                    is kept exactly as entered, including spaces.
                  </p>
                </div>

                <form className="space-y-5" onSubmit={handleSubmit} noValidate>
                  <PasswordField
                    id="new-password"
                    label="New password"
                    value={password}
                    onChange={setPassword}
                    visible={showPassword}
                    onToggleVisibility={() =>
                      setShowPassword((visible) => !visible)
                    }
                  />

                  <PasswordField
                    id="confirm-password"
                    label="Confirm new password"
                    value={confirmation}
                    onChange={setConfirmation}
                    visible={showConfirmation}
                    onToggleVisibility={() =>
                      setShowConfirmation((visible) => !visible)
                    }
                  />

                  {error && (
                    <p
                      id="reset-error"
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
                    {isSubmitting ? "Resetting password…" : "Reset password"}
                  </button>
                </form>
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

          <span className="text-[var(--text)]/70">
            Secure account recovery
          </span>
        </div>
      </div>
    </main>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggleVisibility,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisibility: () => void;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-[var(--text)]">
        {label}
      </label>

      <LiquidLensSurface
        intensity="subtle"
        radius={14}
        className="flex min-h-12 items-center overflow-hidden focus-within:ring-2 focus-within:ring-[var(--accent)]"
        style={{
          background: "var(--surface-solid)",
          color: "var(--text)",
          border: "1px solid var(--border)",
        }}
      >
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          minLength={8}
          maxLength={1024}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-12 min-w-0 flex-1 bg-transparent px-4 text-sm outline-none"
        />

        <button
          type="button"
          onClick={onToggleVisibility}
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="min-h-12 shrink-0 px-4 text-xs font-semibold text-[var(--text-muted)] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--accent)]"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </LiquidLensSurface>
    </div>
  );
}
