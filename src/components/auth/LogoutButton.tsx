
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || result?.success !== true) {
        setError(
          result?.message || "Unable to log out. Please try again."
        );
        setLoading(false);
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setError("Network error. Please try logging out again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Logging out..." : "Log out"}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
