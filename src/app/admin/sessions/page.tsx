
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";
import { LiquidLensButton } from "@/components/ui/LiquidLensButton";

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

  const fetchSessions = useCallback(async (): Promise<AdminSession[]> => {
    const response = await fetch("/api/admin/sessions", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });

    const data: ApiResponse = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load active sessions.");
    }

    return data.sessions ?? [];
  }, []);

  useEffect(() => {
    let active = true;

    fetchSessions()
      .then((data) => {
        if (!active) return;
        setSessions(data);
        setError("");
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load active sessions."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchSessions]);

  async function refreshSessions() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const data = await fetchSessions();
      setSessions(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load active sessions."
      );
    } finally {
      setLoading(false);
    }
  }

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

  const statistics = useMemo(() => {
    const uniqueUsers = new Set(sessions.map((session) => session.userId));
    const uniqueDevices = new Set(
      sessions.map((session) => session.deviceLabel || "Unknown device")
    );

    return {
      sessions: sessions.length,
      users: uniqueUsers.size,
      devices: uniqueDevices.size,
    };
  }, [sessions]);

  return (
    <main className="min-h-screen px-4 py-8 text-white sm:px-6 sm:py-10 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* PAGE HEADER */}
        <header className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/55">
                Super Admin / Security Centre
              </p>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Sessions &amp; Devices
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">
              Monitor authenticated devices, review account activity and
              protect your platform by revoking unwanted sessions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <LiquidLensButton
              onClick={() => void refreshSessions()}
              disabled={loading}
              className="text-sm font-semibold text-white transition hover:opacity-75 disabled:opacity-40"
            >
              {loading ? "Refreshing..." : "↻ Refresh"}
            </LiquidLensButton>

            <Link
              href="/admin"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 bg-white/[0.05] px-5 text-sm font-semibold text-white/85 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.12] hover:border-white/40"
            >
              ← Back to Admin
            </Link>
          </div>
        </header>

        {/* STATISTICS */}
        <section
          aria-label="Session statistics"
          className="grid gap-4 sm:grid-cols-3"
        >
          <LiquidLensSurface
            intensity="medium"
            radius={24}
            className="group transition duration-300 hover:-translate-y-1 hover:shadow-2xl"
          >
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white/60">
                  Active sessions
                </p>
                <span className="text-xl text-emerald-300">◉</span>
              </div>

              <p className="mt-4 text-4xl font-semibold tracking-tight tabular-nums">
                {loading ? "—" : statistics.sessions}
              </p>

              <p className="mt-2 text-xs text-white/45">
                Currently authenticated sessions
              </p>
            </div>
          </LiquidLensSurface>

          <LiquidLensSurface
            intensity="medium"
            radius={24}
            className="group transition duration-300 hover:-translate-y-1 hover:shadow-2xl"
          >
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white/60">
                  Active users
                </p>
                <span className="text-xl text-sky-300">◎</span>
              </div>

              <p className="mt-4 text-4xl font-semibold tracking-tight tabular-nums">
                {loading ? "—" : statistics.users}
              </p>

              <p className="mt-2 text-xs text-white/45">
                Unique users with active sessions
              </p>
            </div>
          </LiquidLensSurface>

          <LiquidLensSurface
            intensity="medium"
            radius={24}
            className="group transition duration-300 hover:-translate-y-1 hover:shadow-2xl"
          >
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white/60">
                  Device labels
                </p>
                <span className="text-xl text-amber-200">◇</span>
              </div>

              <p className="mt-4 text-4xl font-semibold tracking-tight tabular-nums">
                {loading ? "—" : statistics.devices}
              </p>

              <p className="mt-2 text-xs text-white/45">
                Distinct device labels in active sessions
              </p>
            </div>
          </LiquidLensSurface>
        </section>

        {/* MAIN SESSION PANEL */}
        <LiquidLensSurface
          intensity="strong"
          radius={30}
          className="w-full"
        >
          <section className="p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                    Security monitoring
                  </p>
                </div>

                <h2 className="mt-2 text-xl font-semibold tracking-tight">
                  Active user sessions
                </h2>

                <p className="mt-1 text-sm text-white/55">
                  Review the devices currently signed in to your platform.
                </p>
              </div>

              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white/80">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                {loading ? "Checking..." : `${sessions.length} active`}
              </div>
            </div>

            {/* ERROR */}
            {error && (
              <div
                role="alert"
                className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/[0.10] p-4 text-sm text-red-200 backdrop-blur-xl"
              >
                <p className="font-semibold">Something went wrong</p>
                <p className="mt-1 text-red-100/75">{error}</p>
              </div>
            )}

            {/* SUCCESS */}
            {message && (
              <div
                role="status"
                className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.10] p-4 text-sm text-emerald-200 backdrop-blur-xl"
              >
                {message}
              </div>
            )}

            {/* LOADING */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-white/80" />
                <p className="mt-5 text-sm font-medium text-white/70">
                  Loading active sessions
                </p>
                <p className="mt-1 text-xs text-white/40">
                  Retrieving security information...
                </p>
              </div>
            ) : sessions.length === 0 ? (
              /* EMPTY STATE */
              <div className="my-8 flex flex-col items-center rounded-3xl border border-dashed border-white/15 bg-white/[0.025] px-5 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] text-3xl text-white/70">
                  ◇
                </div>

                <h3 className="mt-5 text-lg font-semibold">
                  No active sessions
                </h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-white/50">
                  No unexpired user sessions were found. When users sign in,
                  their active devices will appear here.
                </p>

                <button
                  type="button"
                  onClick={() => void refreshSessions()}
                  className="mt-6 rounded-full border border-white/20 bg-white/[0.07] px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.14]"
                >
                  Check again
                </button>
              </div>
            ) : (
              /* SESSION TILES */
              <div className="mt-7 grid gap-4 xl:grid-cols-2">
                {sessions.map((session) => (
                  <LiquidLensSurface
                    key={session.id}
                    intensity="subtle"
                    radius={24}
                    className="group transition duration-300 hover:-translate-y-1 hover:shadow-2xl"
                  >
                    <article className="p-5 sm:p-6">
                      {/* DEVICE HEADER */}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.07] text-xl text-white/80 transition duration-300 group-hover:border-white/30 group-hover:bg-white/[0.12]">
                            ◈
                          </div>

                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                              Registered device
                            </p>

                            <h3 className="mt-1 break-words font-semibold text-white">
                              {session.deviceLabel || "Unknown device"}
                            </h3>
                          </div>
                        </div>

                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/[0.09] px-3 py-1.5 text-xs font-semibold text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Active
                        </span>
                      </div>

                      {/* USER INFORMATION */}
                      <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/[0.10] p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                          Account
                        </p>

                        <p className="mt-2 break-all text-sm font-medium text-white/90">
                          {session.user.email}
                        </p>

                        <p className="mt-1 break-all text-[11px] text-white/40">
                          User ID: {session.userId}
                        </p>
                      </div>

                      {/* SESSION TIMELINE */}
                      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                            Signed in
                          </p>
                          <p className="mt-2 text-xs leading-5 text-white/80">
                            {formatDate(session.createdAt)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                            Last active
                          </p>
                          <p className="mt-2 text-xs leading-5 text-white/80">
                            {formatDate(session.lastActiveAt)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                            Expires
                          </p>
                          <p className="mt-2 text-xs leading-5 text-white/80">
                            {formatDate(session.expiresAt)}
                          </p>
                        </div>
                      </div>

                      {/* ACTION */}
                      <div className="mt-5 flex justify-end border-t border-white/[0.09] pt-4">
                        <LiquidLensButton
                          onClick={() => void forceLogout(session)}
                          disabled={revokingId !== null}
                          className="text-xs font-semibold text-red-200 transition hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                          style={{
                            borderRadius: 999,
                            padding: "0.65rem 1.1rem",
                          }}
                        >
                          {revokingId === session.id
                            ? "Revoking session..."
                            : "Force Logout"}
                        </LiquidLensButton>
                      </div>
                    </article>
                  </LiquidLensSurface>
                ))}
              </div>
            )}

            {/* FOOTNOTE */}
            <div className="mt-7 border-t border-white/10 pt-5">
              <p className="max-w-3xl text-xs leading-6 text-white/45">
                Revoking a session prevents future authenticated requests
                from that session. The affected user may need to sign in
                again. This action does not delete the user&apos;s account.
              </p>
            </div>
          </section>
        </LiquidLensSurface>
      </div>
    </main>
  );
}
