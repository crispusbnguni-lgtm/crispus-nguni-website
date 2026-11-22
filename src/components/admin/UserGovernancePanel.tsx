
"use client";

import { useCallback, useEffect, useState } from "react";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";

type GovernanceAccount = {
  id: string;
  name: string | null;
  email: string | null;
  role: "USER" | "SUPER_ADMIN";
  createdAt: string;
  accountStatus: "ACTIVE" | "SUSPENDED" | "BANNED";
  accountStatusReason: string | null;
  accountSuspendedUntil: string | null;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  verificationReason: string | null;
  accessAllowed: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  mfaEnrolled: boolean;
  activeRecoveryCodeCount: number;
};

type HistoryItem = {
  eventId: string | null;
  action: string;
  createdAt: string;
  actor: { id: string; name: string | null } | null;
  metadata: unknown;
};

type Action =
  | "VERIFY"
  | "REJECT"
  | "SUSPEND"
  | "BAN"
  | "REINSTATE"
  | "REVOKE_SESSIONS";

const actionLabels: Record<Action, string> = {
  VERIFY: "Verify account",
  REJECT: "Reject verification",
  SUSPEND: "Suspend account",
  BAN: "Permanently ban",
  REINSTATE: "Reinstate account",
  REVOKE_SESSIONS: "Revoke all sessions",
};

const panelClass =
  "rounded-[24px] border border-[var(--admin-line)] bg-[var(--admin-panel)] p-5 shadow-[0_18px_55px_rgba(0,0,0,0.12)] sm:p-7";

const controlClass =
  "min-h-11 rounded-xl border border-white/15 bg-white/[0.045] px-4 py-2.5 text-sm font-medium text-[var(--admin-text)] transition hover:border-blue-300/40 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40";

function auditReason(event: HistoryItem): string {
  if (
    !event.metadata ||
    typeof event.metadata !== "object" ||
    Array.isArray(event.metadata)
  ) {
    return "Reason unavailable";
  }

  const value = (event.metadata as Record<string, unknown>).actionReason;

  return typeof value === "string" ? value : "Reason unavailable";
}

function formatted(value: string): string {
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(new Date(value));
}

export function UserGovernancePanel({
  userId,
  administratorId,
}: {
  userId: string;
  administratorId: string;
}) {
  const [account, setAccount] = useState<GovernanceAccount | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isSelf = userId === administratorId;

  const reload = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/admin/accounts/${encodeURIComponent(userId)}/governance`,
        {
          cache: "no-store",
          credentials: "same-origin",
        },
      );

      const result = (await response.json()) as {
        success?: boolean;
        message?: string;
        account?: GovernanceAccount;
        history?: HistoryItem[];
      };

      if (!response.ok || !result.success || !result.account) {
        throw new Error(
          result.message ?? "Account details could not be loaded.",
        );
      }

      setAccount(result.account);
      setHistory(Array.isArray(result.history) ? result.history : []);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Account details could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialAccount() {
      try {
        const response = await fetch(
          `/api/admin/accounts/${encodeURIComponent(userId)}/governance`,
          {
            cache: "no-store",
            credentials: "same-origin",
          },
        );

        const result = (await response.json()) as {
          success?: boolean;
          message?: string;
          account?: GovernanceAccount;
          history?: HistoryItem[];
        };

        if (!response.ok || !result.success || !result.account) {
          throw new Error(
            result.message ?? "Account details could not be loaded.",
          );
        }

        if (cancelled) return;

        setAccount(result.account);
        setHistory(Array.isArray(result.history) ? result.history : []);
        setError("");
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Account details could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialAccount();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const availableActions: Action[] = account
    ? [
        ...(account.verificationStatus !== "VERIFIED"
          ? (["VERIFY"] as const)
          : []),
        ...(account.verificationStatus !== "REJECTED"
          ? (["REJECT"] as const)
          : []),
        ...(account.accountStatus === "ACTIVE"
          ? (["SUSPEND"] as const)
          : []),
        ...(account.accountStatus !== "BANNED"
          ? (["BAN"] as const)
          : []),
        ...(account.accountStatus !== "ACTIVE" ||
        account.verificationStatus === "REJECTED"
          ? (["REINSTATE"] as const)
          : []),
        "REVOKE_SESSIONS",
      ]
    : [];

  async function submitAction() {
    if (!pendingAction || reason.trim().length < 6 || reason.length > 500) {
      return;
    }

    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/accounts/${encodeURIComponent(userId)}/governance`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: pendingAction,
            reason: reason.trim(),
            ...(pendingAction === "SUSPEND" && expiresAt
              ? { expiresAt: new Date(expiresAt).toISOString() }
              : {}),
          }),
        },
      );

      const result = (await response.json()) as {
        success?: boolean;
        message?: string;
        changed?: boolean;
        revokedCount?: number;
      };

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ?? "The account action could not be completed.",
        );
      }

      setNotice(
        pendingAction === "REVOKE_SESSIONS"
          ? `${result.revokedCount ?? 0} active sessions revoked.`
          : `${actionLabels[pendingAction]} completed.`,
      );

      setPendingAction(null);
      setReason("");
      setExpiresAt("");

      setLoading(true);
      setError("");
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The account action could not be completed.",
      );
      setPendingAction(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-8 space-y-5" aria-labelledby="governance-heading">
      <LiquidLensSurface
        radius={24}
        intensity="subtle"
        className={panelClass}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--admin-faint)]">
              People &amp; access
            </p>

            <h2
              id="governance-heading"
              className="mt-2 text-xl font-semibold text-[var(--admin-text)]"
            >
              Account governance
            </h2>

            <p className="mt-1 text-sm text-[var(--admin-muted)]">
              Review, protect, and restore this account. Changes and reasons
              are written to the administrative history.
            </p>
          </div>

          <button
            type="button"
            className={controlClass}
            onClick={() => {
              setLoading(true);
              setError("");
              void reload();
            }}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {loading && (
          <p className="mt-6 text-sm text-[var(--admin-muted)]">
            Loading security status…
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-200"
          >
            {error}
          </p>
        )}

        {notice && (
          <p
            role="status"
            className="mt-5 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-sm text-emerald-100"
          >
            {notice}
          </p>
        )}

        {account && !loading && (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Account state", account.accountStatus],
                ["Review", account.verificationStatus],
                ["Email", account.emailVerified ? "Verified" : "Unverified"],
                ["Phone", account.phoneVerified ? "Verified" : "Unverified"],
                [
                  "Multi-factor",
                  account.mfaEnrolled ? "TOTP enrolled" : "Not enrolled",
                ],
                ["Recovery codes", String(account.activeRecoveryCodeCount)],
                ["Access", account.accessAllowed ? "Allowed" : "Restricted"],
                ["Role", account.role],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-[var(--admin-line)] bg-black/10 p-4"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--admin-faint)]">
                    {label}
                  </p>
                  <p className="mt-2 break-words text-sm font-semibold text-[var(--admin-text)]">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {(account.accountStatusReason || account.verificationReason) && (
              <p className="mt-4 text-sm text-[var(--admin-muted)]">
                Current note:{" "}
                {account.accountStatusReason ?? account.verificationReason}
              </p>
            )}

            {account.accountSuspendedUntil && (
              <p className="mt-2 text-sm text-[var(--admin-muted)]">
                Suspension expiry:{" "}
                {formatted(account.accountSuspendedUntil)}
              </p>
            )}

            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.7fr)]">
              <label className="text-sm text-[var(--admin-muted)]">
                Administrative reason{" "}
                <span className="text-[var(--admin-faint)]">
                  (required, 6–500 characters)
                </span>

                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-[var(--admin-line)] bg-black/15 px-4 py-3 text-sm text-[var(--admin-text)] outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  placeholder="Record the policy or case reason. Do not include contact details or secrets."
                />
              </label>

              <div>
                {availableActions.includes("SUSPEND") && (
                  <label className="block text-sm text-[var(--admin-muted)]">
                    Optional suspension expiry

                    <input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(event) => setExpiresAt(event.target.value)}
                      className="mt-2 min-h-11 w-full rounded-xl border border-[var(--admin-line)] bg-black/15 px-3 text-sm text-[var(--admin-text)]"
                    />
                  </label>
                )}

                <p className="mt-2 text-xs leading-5 text-[var(--admin-faint)]">
                  Leave expiry blank for an open-ended suspension. Bans remain
                  in force until an administrator reinstates the account.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {availableActions.map((action) => (
                <button
                  key={action}
                  type="button"
                  disabled={
                    isSelf ||
                    reason.trim().length < 6 ||
                    submitting
                  }
                  onClick={() => setPendingAction(action)}
                  className={`${controlClass} ${
                    action === "BAN" || action === "REJECT"
                      ? "border-red-300/25 text-red-100 hover:bg-red-500/10"
                      : ""
                  }`}
                >
                  {actionLabels[action]}
                </button>
              ))}

              {isSelf && (
                <p className="basis-full text-xs text-[var(--admin-faint)]">
                  Self-administration is disabled to protect administrator
                  access.
                </p>
              )}
            </div>
          </>
        )}
      </LiquidLensSurface>

      <LiquidLensSurface
        radius={24}
        intensity="subtle"
        className={panelClass}
      >
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--admin-faint)]">
              Governance record
            </p>

            <h2 className="mt-2 text-xl font-semibold text-[var(--admin-text)]">
              Administrative history
            </h2>
          </div>

          <span className="text-xs text-[var(--admin-faint)]">
            Latest 50 events
          </span>
        </div>

        {history.length === 0 ? (
          <p className="mt-5 text-sm text-[var(--admin-muted)]">
            No governance actions recorded for this account.
          </p>
        ) : (
          <ol className="mt-5 divide-y divide-[var(--admin-line)]">
            {history.map((event, index) => (
              <li
                key={
                  event.eventId ??
                  `${event.action}-${event.createdAt}-${index}`
                }
                className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:items-start"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--admin-text)]">
                    {event.action.replaceAll("_", " ")}
                  </p>

                  <p className="mt-1 text-sm text-[var(--admin-muted)]">
                    {auditReason(event)}
                  </p>

                  <p className="mt-1 text-xs text-[var(--admin-faint)]">
                    By {event.actor?.name || "Former administrator"}
                  </p>
                </div>

                <time
                  className="text-xs text-[var(--admin-faint)]"
                  dateTime={event.createdAt}
                >
                  {formatted(event.createdAt)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </LiquidLensSurface>

      {pendingAction && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/65 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !submitting
            ) {
              setPendingAction(null);
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="governance-confirm-title"
            aria-describedby="governance-confirm-description"
            className="w-full max-w-lg rounded-[26px] border border-white/15 bg-[#101722] p-6 shadow-2xl sm:p-8"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-200">
              Confirm administrative action
            </p>

            <h2
              id="governance-confirm-title"
              className="mt-3 text-xl font-semibold text-white"
            >
              {actionLabels[pendingAction]}?
            </h2>

            <p
              id="governance-confirm-description"
              className="mt-3 text-sm leading-6 text-white/70"
            >
              This change is recorded with your administrator identity and
              reason. Account restrictions revoke active sessions and
              immediately block existing sessions.
            </p>

            <p className="mt-4 rounded-xl bg-white/[0.05] p-3 text-sm text-white/75">
              Reason: {reason.trim()}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className={controlClass}
                onClick={() => setPendingAction(null)}
                disabled={submitting}
              >
                Cancel
              </button>

              <button
                type="button"
                className={`${controlClass} border-blue-300/30 bg-blue-500/20`}
                onClick={() => void submitAction()}
                disabled={submitting}
              >
                {submitting ? "Working…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
