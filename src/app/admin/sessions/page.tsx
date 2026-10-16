
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type AdminSession = {
  id: string;
  userId: string;
  deviceLabel: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
  };
};

type ApiResponse = {
  success: boolean;
  message?: string;
  sessions?: AdminSession[];
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/sessions", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      const data: ApiResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load active sessions."
        );
      }

      setSessions(data.sessions ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load active sessions."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  async function forceLogout(session: AdminSession) {
    const confirmed = window.confirm(
      `Force logout ${session.user.email} from ${
        session.deviceLabel || "this device"
      }?\n\nThe session will be revoked and that device will need to sign in again.`
    );

    if (!confirmed) return;

    setRevokingId(session.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/sessions", {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: session.id,
        }),
      });

      const data: ApiResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Force logout failed.");
      }

      setSessions((current) =>
        current.filter((item) => item.id !== session.id)
      );

      setMessage(
        `Successfully revoked the session for ${session.user.email}.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to revoke this session."
      );
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <main
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-10"
      style={{
        background: "var(--background)",
        color: "var(--text)",
      }}
    >
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p
              className="text-sm font-semibold uppercase tracking-[0.2em]"
              style={{ color: "var(--text-muted)" }}
            >
              Super Admin
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Sessions & Devices
            </h1>

            <p
              className="mt-2 max-w-2xl text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Monitor active user sessions and force logout
              compromised or unwanted devices.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadSessions()}
              disabled={loading}
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:opacity-80 disabled:opacity-50"
              style={{
                borderColor: "var(--text-muted)",
                color: "var(--text)",
              }}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <Link
              href="/admin"
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:opacity-80"
              style={{
                borderColor: "var(--text-muted)",
                color: "var(--text)",
              }}
            >
              Back to Admin
            </Link>
          </div>
        </header>

        <section
          className="rounded-3xl border p-5 shadow-xl backdrop-blur-xl sm:p-7"
          style={{
            background: "var(--surface, rgba(255,255,255,0.04))",
            borderColor: "var(--border, rgba(255,255,255,0.12))",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                Active user sessions
              </h2>
              <p
                className="mt-1 text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Sessions that have not expired or been revoked.
              </p>
            </div>

            <div
              className="rounded-full border px-4 py-2 text-sm font-semibold"
              style={{
                borderColor: "var(--border, rgba(255,255,255,0.12))",
              }}
            >
              {sessions.length} active
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500"
            >
              {error}
            </div>
          )}

          {message && (
            <div
              role="status"
              className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm"
            >
              {message}
            </div>
          )}

          {loading ? (
            <p
              className="py-12 text-center text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Loading active sessions...
            </p>
          ) : sessions.length === 0 ? (
            <div className="py-14 text-center">
              <h3 className="font-semibold">No active sessions</h3>
              <p
                className="mt-2 text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                No unexpired user sessions were found.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {sessions.map((session) => (
                <article
                  key={session.id}
                  className="rounded-2xl border p-4 sm:p-5"
                  style={{
                    borderColor:
                      "var(--border, rgba(255,255,255,0.12))",
                    background: "rgba(127,127,127,0.04)",
                  }}
                >
                  <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">
                          {session.deviceLabel || "Unknown device"}
                        </h3>

                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
                          Active
                        </span>
                      </div>

                      <p className="mt-2 break-all text-sm font-medium">
                        {session.user.email}
                      </p>

                      <p
                        className="mt-1 break-all text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        User ID: {session.userId}
                      </p>

                      <div
                        className="mt-4 grid gap-3 text-sm sm:grid-cols-3"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <div>
                          <p className="text-xs">Signed in</p>
                          <p className="mt-1">
                            {formatDate(session.createdAt)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs">Last active</p>
                          <p className="mt-1">
                            {formatDate(session.lastActiveAt)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs">Expires</p>
                          <p className="mt-1">
                            {formatDate(session.expiresAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void forceLogout(session)}
                      disabled={revokingId !== null}
                      className="shrink-0 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-500 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {revokingId === session.id
                        ? "Revoking..."
                        : "Force Logout"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <p
            className="mt-6 text-xs leading-5"
            style={{ color: "var(--text-muted)" }}
          >
            Revoking a session prevents future authenticated requests
            from that session. The affected user may need to sign in
            again. This action does not delete the user's account.
          </p>
        </section>
      </div>
    </main>
  );
}
