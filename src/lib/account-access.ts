import "server-only";

type AccountAccessState = Readonly<{
  accountStatus: "ACTIVE" | "SUSPENDED" | "BANNED";
  accountSuspendedUntil: Date | null;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
}>;

/**
 * Central account gate used at primary-auth completion, session issuance and
 * every normal-session validation. Unknown or malformed state fails closed.
 */
export function isAccountAccessAllowed(
  account: AccountAccessState | null | undefined,
  now = new Date(),
): boolean {
  if (!account || !Number.isFinite(now.getTime())) return false;
  if (
    (account.accountStatus !== "ACTIVE" && account.accountStatus !== "SUSPENDED") ||
    (account.verificationStatus !== "PENDING" && account.verificationStatus !== "VERIFIED")
  ) {
    return false;
  }
  if (account.accountStatus === "ACTIVE") return true;
  if (account.accountSuspendedUntil === null) return false;
  if (!(account.accountSuspendedUntil instanceof Date)) return false;
  const expiry = account.accountSuspendedUntil.getTime();
  return Number.isFinite(expiry) && expiry <= now.getTime();
}
