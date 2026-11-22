
"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { useCallback, useEffect, useState } from "react";

type Passkey = {
  id: string;
  name: string | null;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  passkeys?: Passkey[];
  options?: Parameters<typeof startRegistration>[0]["optionsJSON"];
};

function formatDate(value: string | null) {
  if (!value) return "Not used yet";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function deviceDescription(deviceType: string | null) {
  if (deviceType === "multiDevice") return "Synced passkey";
  if (deviceType === "singleDevice") return "Device-bound passkey";
  return "Passkey";
}

const glassCard =
  "rounded-3xl border border-white/[0.12] bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_45px_rgba(0,0,0,0.08)] backdrop-blur-2xl";

const glassButton =
  "inline-flex min-h-10 items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.055] px-4 py-2 text-sm font-medium transition-colors hover:bg-white/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#126BFF] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none";

export default function PasskeyManagement() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [registering, setRegistering] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Initial asynchronous fetch. Kept separate from loadPasskeys so
  // the effect does not synchronously invoke a state-updating callback.
  useEffect(() => {
    let cancelled = false;

    async function loadInitialPasskeys() {
      try {
        const response = await fetch("/api/auth/passkey", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });

        const result = (await response.json().catch(() => null)) as
          | ApiResponse
          | null;

        if (cancelled) return;

        if (!response.ok || result?.success !== true) {
          setError(result?.message || "Unable to load your passkeys.");
          return;
        }

        setPasskeys(result.passkeys ?? []);
        setError("");
      } catch {
        if (!cancelled) {
          setError("Network error while loading passkeys. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialPasskeys();

    return () => {
      cancelled = true;
    };
  }, []);

  // Used by explicit user actions after registration, renaming and revocation.
  const loadPasskeys = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/passkey", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      const result = (await response.json().catch(() => null)) as
        | ApiResponse
        | null;

      if (!response.ok || result?.success !== true) {
        setError(result?.message || "Unable to load your passkeys.");
        return;
      }

      setPasskeys(result.passkeys ?? []);
      setError("");
    } catch {
      setError("Network error while loading passkeys. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function registerPasskey() {
    if (registering || busyId) return;

    setRegistering(true);
    setError("");
    setMessage("");

    try {
      const optionsResponse = await fetch(
        "/api/auth/passkey/register/options",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          cache: "no-store",
        }
      );

      const optionsData = (await optionsResponse.json().catch(() => null)) as
        | ApiResponse
        | null;

      if (
        !optionsResponse.ok ||
        optionsData?.success !== true ||
        !optionsData.options
      ) {
        setError(
          optionsData?.message || "Unable to start passkey registration."
        );
        return;
      }

      const registrationResponse = await startRegistration({
        optionsJSON: optionsData.options,
      });

      const verifyResponse = await fetch(
        "/api/auth/passkey/register/verify",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            response: registrationResponse,
            name: newName.trim() || "Passkey",
          }),
          cache: "no-store",
        }
      );

      const verifyData = (await verifyResponse.json().catch(() => null)) as
        | ApiResponse
        | null;

      if (!verifyResponse.ok || verifyData?.success !== true) {
        setError(
          verifyData?.message || "Unable to verify your new passkey."
        );
        return;
      }

      setNewName("");
      setMessage(verifyData.message || "Passkey registered successfully.");

      setLoading(true);
      setError("");
      await loadPasskeys();
    } catch (cause) {
      if (
        cause instanceof Error &&
        (cause.name === "NotAllowedError" || cause.name === "AbortError")
      ) {
        setError("Passkey registration was cancelled or not completed.");
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : "Passkey registration failed. Please try again."
        );
      }
    } finally {
      setRegistering(false);
    }
  }

  async function renamePasskey(id: string) {
    const name = editingName.trim();

    if (!name || name.length > 80 || busyId) {
      setError("Passkey name must contain between 1 and 80 characters.");
      return;
    }

    setBusyId(id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/auth/passkey", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name }),
        cache: "no-store",
      });

      const result = (await response.json().catch(() => null)) as
        | ApiResponse
        | null;

      if (!response.ok || result?.success !== true) {
        setError(result?.message || "Unable to rename this passkey.");
        return;
      }

      setEditingId("");
      setEditingName("");
      setMessage(result.message || "Passkey renamed successfully.");

      setLoading(true);
      setError("");
      await loadPasskeys();
    } catch {
      setError("Network error while renaming this passkey.");
    } finally {
      setBusyId("");
    }
  }

  async function revokePasskey(passkey: Passkey) {
    if (busyId || registering) return;

    const confirmed = window.confirm(
      `Revoke "${passkey.name || "Passkey"}"? This credential will no longer be able to sign in to your account.`
    );

    if (!confirmed) return;

    setBusyId(passkey.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/auth/passkey", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: passkey.id }),
        cache: "no-store",
      });

      const result = (await response.json().catch(() => null)) as
        | ApiResponse
        | null;

      if (!response.ok || result?.success !== true) {
        setError(result?.message || "Unable to revoke this passkey.");
        return;
      }

      setMessage(result.message || "Passkey revoked successfully.");
      setEditingId("");
      setEditingName("");

      setLoading(true);
      setError("");
      await loadPasskeys();
    } catch {
      setError("Network error while revoking this passkey.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section
      aria-labelledby="passkeys-heading"
      className={`${glassCard} mt-6 overflow-hidden p-5 sm:p-6`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D9A441]">
            Passwordless security
          </p>
          <h2 id="passkeys-heading" className="mt-2 text-xl font-semibold">
            Passkeys
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            Register and manage the passkeys that let you sign in using your
            device&apos;s fingerprint, face recognition, screen lock or
            password manager. Your biometric data stays with your device.
          </p>
        </div>

        <span className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-1.5 text-xs text-emerald-300">
          {passkeys.length} {passkeys.length === 1 ? "passkey" : "passkeys"}
        </span>
      </div>

      <div className="mt-5 rounded-2xl border border-white/[0.10] bg-white/[0.025] p-4">
        <label
          htmlFor="new-passkey-name"
          className="block text-sm font-medium"
        >
          Name this passkey (optional)
        </label>
        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
          Use a name you will recognize, such as &quot;My Samsung phone&quot;
          or &quot;Personal laptop&quot;.
        </p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            id="new-passkey-name"
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value.slice(0, 80))}
            maxLength={80}
            placeholder="e.g. Personal phone"
            disabled={registering}
            className="min-h-11 min-w-0 flex-1 rounded-2xl border border-white/[0.14] bg-black/[0.12] px-4 text-sm text-[var(--text)] outline-none transition focus:border-[#126BFF]/60 focus:ring-2 focus:ring-[#126BFF]/20 disabled:opacity-50"
          />

          <button
            type="button"
            onClick={() => void registerPasskey()}
            disabled={registering || Boolean(busyId)}
            className={glassButton}
          >
            {registering ? "Registering..." : "Add a passkey"}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/[0.07] p-4 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] p-4 text-sm text-emerald-300"
        >
          {message}
        </div>
      )}

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Registered passkeys</h3>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError("");
              void loadPasskeys();
            }}
            disabled={loading || registering || Boolean(busyId)}
            className="text-xs font-medium text-[#D9A441] underline-offset-4 hover:underline disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh list"}
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/[0.10] bg-white/[0.025] p-6 text-center text-sm text-[var(--text-muted)]">
            Loading your passkeys...
          </div>
        ) : passkeys.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.14] bg-white/[0.02] p-6 text-center">
            <p className="text-sm font-medium">No passkeys registered yet</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              Add a passkey to make future sign-ins faster and more resistant
              to phishing.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {passkeys.map((passkey) => {
              const editing = editingId === passkey.id;
              const busy = busyId === passkey.id;

              return (
                <article
                  key={passkey.id}
                  className="rounded-2xl border border-white/[0.10] bg-white/[0.025] p-4"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      {editing ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            aria-label="New passkey name"
                            type="text"
                            value={editingName}
                            onChange={(event) =>
                              setEditingName(event.target.value.slice(0, 80))
                            }
                            maxLength={80}
                            className="min-h-10 min-w-0 flex-1 rounded-xl border border-white/[0.14] bg-black/[0.12] px-3 text-sm text-[var(--text)] outline-none focus:border-[#126BFF]/60"
                          />
                          <button
                            type="button"
                            onClick={() => void renamePasskey(passkey.id)}
                            disabled={busy || !editingName.trim()}
                            className={glassButton}
                          >
                            {busy ? "Saving..." : "Save name"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId("");
                              setEditingName("");
                            }}
                            disabled={busy}
                            className={glassButton}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="break-words font-semibold">
                            {passkey.name || "Passkey"}
                          </h4>
                          <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
                            {deviceDescription(passkey.deviceType)}
                          </span>
                        </div>
                      )}

                      <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="text-[var(--text-muted)]">
                            Registered
                          </dt>
                          <dd className="mt-1">
                            {formatDate(passkey.createdAt)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[var(--text-muted)]">
                            Last used
                          </dt>
                          <dd className="mt-1">
                            {formatDate(passkey.lastUsedAt)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[var(--text-muted)]">
                            Backup status
                          </dt>
                          <dd className="mt-1">
                            {passkey.backedUp
                              ? "Backed up or synced"
                              : "Not reported as backed up"}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {!editing && (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setError("");
                            setEditingId(passkey.id);
                            setEditingName(passkey.name || "Passkey");
                          }}
                          disabled={Boolean(busyId) || registering}
                          className={glassButton}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => void revokePasskey(passkey)}
                          disabled={Boolean(busyId) || registering}
                          className="inline-flex min-h-10 items-center justify-center rounded-full border border-red-400/25 bg-red-500/[0.06] px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                        >
                          {busy ? "Revoking..." : "Revoke"}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-5 text-xs leading-5 text-[var(--text-muted)]">
        Revoking a passkey prevents it from being used for future
        authentication. It does not delete the passkey from the device or
        password manager where it was created.
      </p>
    </section>
  );
}
