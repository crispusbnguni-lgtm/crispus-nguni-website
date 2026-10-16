
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Session = {
  id: string;
  deviceLabel: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
};

type SessionsResponse = {
  success: boolean;
  message?: string;
  currentSessionId?: string;
  sessions?: Session[];
};

type ActionResponse = {
  success?: boolean;
  message?: string;
  revokedCount?: number;
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function SessionsPage() {
  const router = useRouter();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState("");
  const [bulkAction, setBulkAction] = useState<
    "" | "revoke-others" | "revoke-all"
  >("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/sessions", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      const result =
        (await response.json().catch(() => null)) as SessionsResponse | null;

      if (!response.ok || !result?.success) {
        setError(result?.message || "Unable to load your active sessions.");
        return;
      }

      setSessions(result.sessions ?? []);
      setCurrentSessionId(result.currentSessionId ?? "");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

 useEffect(() => {
  let cancelled = false;

  async function initialLoad() {
    try {
      const response = await fetch("/api/sessions", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      const result =
        (await response.json().catch(() => null)) as SessionsResponse | null;

      if (cancelled) return;

      if (!response.ok || !result?.success) {
        setError(
          result?.message || "Unable to load your active sessions."
        );
        return;
      }

      setSessions(result.sessions ?? []);
      setCurrentSessionId(result.currentSessionId ?? "");
    } catch {
      if (!cancelled) {
        setError("Network error. Please try again.");
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  void initialLoad();

  return () => {
    cancelled = true;
  };
}, []);

  async function runBulkAction(
    action: "revoke-others" | "revoke-all"
  ) {
    if (bulkAction || revokingId) return;

    const isAll = action === "revoke-all";

    const confirmed = window.confirm(
      isAll
        ? "Sign out this account on every device, including this one? You will need to sign in again."
        : "Sign out every other active device? This device will remain signed in."
    );

    if (!confirmed) return;

    setBulkAction(action);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/sessions", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const result = (await response.json().catch(() => null)) as
        | ActionResponse
        | null;

      if (!response.ok || result?.success !== true) {
        setError(result?.message || "Unable to complete this action.");
        return;
      }

      setMessage(result.message || "Session action completed.");

      if (isAll) {
        router.replace("/login");
        router.refresh();
        return;
      }

      await loadSessions();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBulkAction("");
    }
  }

  async function revokeSession(session: Session) {
    if (revokingId || bulkAction) return;

    const confirmed = window.confirm(
      `Sign out ${session.deviceLabel || "this device"}? That device will need to sign in again.`
    );

    if (!confirmed) return;

    setRevokingId(session.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/sessions", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });

      const result = (await response.json().catch(() => null)) as
        | ActionResponse
        | null;

      if (!response.ok || result?.success !== true) {
        setError(result?.message || "Unable to revoke this session.");
        return;
      }

      setMessage(result.message || "Session revoked successfully.");
      await loadSessions();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setRevokingId("");
    }
  }

  const glassCard =
    "rounded-3xl border border-white/[0.12] bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_45px_rgba(0,0,0,0.08)] backdrop-blur-2xl";

  const glassButton =
    "inline-flex min-h-10 items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.055] px-4 py-2 text-sm font-medium transition-colors hover:bg-white/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#126BFF] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none";

  return (
    <main className="min-h-screen bg-transparent px-4 py-6 text-[var(--text)] sm:px-6 sm:py-9 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className={`${glassCard} p-5 sm:p-7`}>
          <Link
            href="/dashboard"
            className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          >
            ← Back to workspace
          </Link>

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D9A441]">
                Account security
              </p>

              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Sessions &amp; Devices
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">
                Review where your account is signed in. If you see a device you
                do not recognize, revoke its session to require another sign-in.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadSessions()}
              disabled={loading || Boolean(bulkAction) || Boolean(revokingId)}
              className={glassButton}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#D9A441]/20 bg-[#D9A441]/[0.06] p-4">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#D9A441]/20 text-[#D9A441]"
            >
              !
            </span>

            <p className="text-sm leading-6 text-[var(--text-muted)]">
              <strong className="text-[var(--text)]">Security tip:</strong>{" "}
              Never share your password or sign-in codes. Revoking a session
              prevents that session from authenticating future requests, but
              cannot undo activity that already occurred.
            </p>
          </div>
        </header>

        <section
          aria-labelledby="bulk-actions-heading"
          className={`${glassCard} mt-6 p-5 sm:p-6`}
        >
          <h2 id="bulk-actions-heading" className="text-xl font-semibold">
            Manage all devices
          </h2>

          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Choose whether to keep this device signed in or end every active
            session on your account.
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => void runBulkAction("revoke-others")}
              disabled={
                loading ||
                Boolean(bulkAction) ||
                Boolean(revokingId) ||
                !currentSessionId
              }
              className={glassButton}
            >
              {bulkAction === "revoke-others"
                ? "Signing out other devices..."
                : "Log out other devices"}
            </button>

            <button
              type="button"
              onClick={() => void runBulkAction("revoke-all")}
              disabled={
                loading ||
                Boolean(bulkAction) ||
                Boolean(revokingId) ||
                !currentSessionId
              }
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-red-400/25 bg-red-500/[0.06] px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              {bulkAction === "revoke-all"
                ? "Ending all sessions..."
                : "Log out everywhere"}
            </button>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/[0.07] p-4 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] p-4 text-sm text-emerald-300"
          >
            {message}
          </div>
        )}

        <section className="mt-6">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Active sessions</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Devices with sessions that have not expired or been revoked.
              </p>
            </div>

            {!loading && (
              <span className="shrink-0 rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-xs text-[var(--text-muted)]">
                {sessions.length}{" "}
                {sessions.length === 1 ? "session" : "sessions"}
              </span>
            )}
          </div>

          {loading ? (
            <div className={`${glassCard} p-8 text-center`}>
              <div
                aria-hidden="true"
                className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#D9A441] motion-reduce:animate-none"
              />
              <p className="mt-4 text-sm text-[var(--text-muted)]">
                Loading your sessions...
              </p>
            </div>
          ) : sessions.length === 0 ? (
            <div className={`${glassCard} p-8 text-center`}>
              <h3 className="font-semibold">No active sessions found</h3>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Refresh the list or sign in again if your session has expired.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => {
                const isCurrent = session.id === currentSessionId;

                return (
                  <article
                    key={session.id}
                    className={`${glassCard} overflow-hidden p-5 sm:p-6`}
                  >
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#126BFF]/25 bg-[#126BFF]/[0.08] text-[#80B5FF]">
                          <svg
                            viewBox="0 0 24 24"
                            className="h-6 w-6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <rect x="3" y="4" width="18" height="13" rx="2" />
                            <path d="M8 21h8M12 17v4" />
                          </svg>
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="break-words font-semibold">
                              {session.deviceLabel || "Unknown device"}
                            </h3>

                            {isCurrent && (
                              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                                This device
                              </span>
                            )}
                          </div>

                          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                            <div>
                              <dt className="text-[var(--text-muted)]">
                                Last active
                              </dt>
                              <dd className="mt-1 break-words">
                                {formatDate(session.lastActiveAt)}
                              </dd>
                            </div>

                            <div>
                              <dt className="text-[var(--text-muted)]">
                                Signed in
                              </dt>
                              <dd className="mt-1 break-words">
                                {formatDate(session.createdAt)}
                              </dd>
                            </div>

                            <div>
                              <dt className="text-[var(--text-muted)]">
                                Session expires
                              </dt>
                              <dd className="mt-1 break-words">
                                {formatDate(session.expiresAt)}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </div>

                      {isCurrent ? (
                        <span className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-emerald-400/20 px-4 py-2 text-sm text-emerald-300">
                          Currently signed in
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void revokeSession(session)}
                          disabled={Boolean(revokingId) || Boolean(bulkAction)}
                          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-red-400/25 bg-red-500/[0.06] px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                        >
                          {revokingId === session.id
                            ? "Revoking..."
                            : "Revoke session"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="mt-8 text-sm text-[var(--text-muted)]">
          Need to leave this device?{" "}
          <Link
            href="/dashboard"
            className="font-medium text-[#D9A441] underline-offset-4 hover:underline"
          >
            Return to your workspace
          </Link>{" "}
          and use Log out.
        </footer>
      </div>
    </main>
  );
}
