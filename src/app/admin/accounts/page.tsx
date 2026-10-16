
import Link from "next/link";
import { headers } from "next/headers";
import { requireSuperAdmin } from "@/lib/authorization";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";

export const dynamic = "force-dynamic";

type Account = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  portfolioSite: {
    id: string;
    slug: string;
    published: boolean;
    title: string;
  } | null;
  sessions: {
    id: string;
    deviceLabel: string | null;
    createdAt: string;
    lastActiveAt: string;
    expiresAt: string;
  }[];
  activeSessionCount: number;
  status: "ONLINE" | "OFFLINE";
};

type AccountsResponse = {
  success: boolean;
  message?: string;
  accounts: Account[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  stats: {
    totalUsers: number;
    activeSessions: number;
  };
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(new Date(value));
}

const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2.5 text-center text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accounts-accent)]";

function StatCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: number;
  detail: string;
  accent?: string;
}) {
  return (
    <LiquidLensSurface
      radius={24}
      intensity="medium"
      className="h-full min-w-0 border p-5 sm:p-6"
      style={{ borderColor: "var(--accounts-border)" }}
    >
      <p className="text-sm" style={{ color: "var(--accounts-muted)" }}>
        {label}
      </p>
      <p
        className="mt-3 break-words text-3xl font-semibold tabular-nums tracking-tight"
        style={{ color: accent ?? "var(--accounts-text)" }}
      >
        {value.toLocaleString()}
      </p>
      <p
        className="mt-2 text-sm leading-6"
        style={{ color: "var(--accounts-muted)" }}
      >
        {detail}
      </p>
    </LiquidLensSurface>
  );
}

function getDeviceLabel(session: Account["sessions"][number]) {
  if (session.deviceLabel?.trim()) return session.deviceLabel;

  return "Device not identified";
}

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}) {
  await requireSuperAdmin();

  const params = await searchParams;
  const search = (params.search ?? "").trim().slice(0, 100);
  const parsedPage = Number(params.page ?? "1");
  const page =
    Number.isSafeInteger(parsedPage) && parsedPage > 0
      ? Math.min(parsedPage, 1_000_000)
      : 1;

  const query = new URLSearchParams();
  if (search) query.set("search", search);
  query.set("page", String(page));

  const incomingHeaders = await headers();
  const cookie = incomingHeaders.get("cookie");

  const configuredOrigin = process.env.APP_URL?.replace(/\/$/, "");
  const host =
    incomingHeaders.get("x-forwarded-host") ??
    incomingHeaders.get("host");

  const forwardedProtocol =
    incomingHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();

  const protocol =
    forwardedProtocol ??
    (process.env.NODE_ENV === "development" ? "http" : "https");

  const origin =
    configuredOrigin ??
    (host && /^[a-zA-Z0-9.:[\]-]+$/.test(host)
      ? `${protocol}://${host}`
      : null);

  let data: AccountsResponse | null = null;
  let loadError = "";

  if (!origin) {
    loadError =
      "The application URL could not be determined. Configure APP_URL and try again.";
  } else {
    try {
      const response = await fetch(
        `${origin}/api/admin/accounts?${query.toString()}`,
        {
          cache: "no-store",
          headers: cookie ? { cookie } : undefined,
        },
      );

      if (!response.ok) {
        loadError =
          response.status === 401 || response.status === 403
            ? "Your Super Admin session could not be authorized for this request. Please sign in again."
            : "The account directory could not be loaded.";
      } else {
        const result = (await response.json()) as AccountsResponse;

        if (result.success && Array.isArray(result.accounts)) {
          data = result;
        } else {
          loadError =
            result.message ?? "The account directory returned an unexpected response.";
        }
      }
    } catch (error) {
      console.error("Admin accounts page error:", error);
      loadError = "Unable to connect to the account directory.";
    }
  }

  const accounts = data?.accounts ?? [];
  const pagination = data?.pagination;
  const stats = data?.stats;
  const totalPages = pagination?.totalPages ?? 0;
  const currentPage = pagination?.page ?? page;

  function pageHref(nextPage: number) {
    const next = new URLSearchParams();
    if (search) next.set("search", search);
    next.set("page", String(nextPage));
    return `/admin/accounts?${next.toString()}`;
  }

  return (
    <main
      className="min-h-screen overflow-x-clip px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
      style={{
        color: "var(--accounts-text, var(--theme-text, var(--foreground, CanvasText)))",
        fontFamily: "var(--reader-font-family, inherit)",
        fontSize: "calc(1rem * var(--reader-text-scale, 1))",
        lineHeight: "var(--reader-line-height, 1.6)",
        letterSpacing: "var(--reader-letter-spacing, normal)",
      }}
    >
      <style>{`
        .accounts-theme {
          --accounts-text: var(--theme-text, var(--foreground, CanvasText));
          --accounts-muted: var(--theme-muted, var(--muted-foreground, GrayText));
          --accounts-border: var(--theme-border, var(--border, color-mix(in srgb, currentColor 16%, transparent)));
          --accounts-panel: var(--theme-surface, color-mix(in srgb, currentColor 4%, transparent));
          --accounts-accent: var(--theme-accent, #126BFF);
          --accounts-good: var(--theme-success, #00A875);
          --accounts-warning: var(--theme-warning, #B47A19);
          color: var(--accounts-text);
        }

        html[data-theme="dark"] .accounts-theme {
          --accounts-text: var(--theme-text, #F3F6FC);
          --accounts-muted: var(--theme-muted, #A0AABC);
          --accounts-border: var(--theme-border, rgba(255,255,255,.13));
          --accounts-panel: var(--theme-surface, rgba(255,255,255,.035));
        }

        html[data-theme="light"] .accounts-theme {
          --accounts-text: var(--theme-text, #182235);
          --accounts-muted: var(--theme-muted, #5D6879);
          --accounts-border: var(--theme-border, rgba(25,42,67,.15));
          --accounts-panel: var(--theme-surface, rgba(255,255,255,.52));
        }

        html[data-theme="sepia"] .accounts-theme {
          --accounts-text: var(--theme-text, #433628);
          --accounts-muted: var(--theme-muted, #796852);
          --accounts-border: var(--theme-border, rgba(105,78,45,.2));
          --accounts-panel: var(--theme-surface, rgba(255,249,235,.5));
          --accounts-accent: var(--theme-accent, #916522);
        }

        html[data-high-contrast="true"] .accounts-theme {
          --accounts-border: currentColor;
        }

        .accounts-theme a,
        .accounts-theme button,
        .accounts-theme input,
        .accounts-theme summary {
          -webkit-tap-highlight-color: transparent;
        }

        html[data-underline-links="true"] .accounts-theme a {
          text-decoration: underline;
          text-underline-offset: 4px;
        }

        html[data-reduce-motion="true"] .accounts-theme *,
        html[data-reduce-motion="true"] .accounts-theme *::before,
        html[data-reduce-motion="true"] .accounts-theme *::after {
          animation-duration: .01ms !important;
          animation-iteration-count: 1 !important;
          scroll-behavior: auto !important;
          transition-duration: .01ms !important;
        }

        html[data-reduce-transparency="true"] .accounts-theme {
          --accounts-panel: Canvas;
        }

        .accounts-theme input::placeholder {
          color: var(--accounts-muted);
          opacity: .8;
        }

        .accounts-theme input:focus-visible,
        .accounts-theme a:focus-visible,
        .accounts-theme button:focus-visible,
        .accounts-theme summary:focus-visible {
          outline: 2px solid var(--accounts-accent);
          outline-offset: 3px;
        }
      `}</style>

      <div className="accounts-theme mx-auto w-full max-w-7xl">
        <header
          className="flex min-w-0 flex-col gap-5 border-b pb-7 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "var(--accounts-border)" }}
        >
          <div className="min-w-0">
            <Link
              href="/admin"
              className="inline-flex text-2xl font-semibold tracking-tight transition-opacity hover:opacity-75"
            >
              Crispus<span style={{ color: "var(--accounts-accent)" }}>.</span>
            </Link>
            <p
              className="mt-2 text-sm"
              style={{ color: "var(--accounts-muted)" }}
            >
              Super Admin Console / All Accounts
            </p>
          </div>

          <nav
            aria-label="Account administration"
            className="flex flex-wrap gap-2"
          >
            <Link
              href="/admin"
              className={buttonClass}
              style={{ borderColor: "var(--accounts-border)" }}
            >
              Admin Home
            </Link>
            <Link
              href="/admin#display-studio"
              className={buttonClass}
              style={{ borderColor: "var(--accounts-border)" }}
            >
              Display Studio
            </Link>
            <Link
              href="/admin/sessions"
              className={buttonClass}
              style={{ borderColor: "var(--accounts-border)" }}
            >
              Sessions &amp; Devices
            </Link>
          </nav>
        </header>

        <section className="py-9 sm:py-12">
          <p
            className="text-xs font-semibold uppercase tracking-[0.22em] sm:text-sm"
            style={{ color: "var(--accounts-warning)" }}
          >
            Account Management
          </p>

          <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight sm:text-5xl">
            All Accounts
          </h1>

          <p
            className="mt-4 max-w-2xl text-sm leading-7 sm:text-base"
            style={{ color: "var(--accounts-muted)" }}
          >
            Review registered accounts, portfolio publication status and
            authenticated sessions. Your existing Display Studio settings
            control the page typography, glass optics, theme and accessibility.
          </p>

          {stats && (
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard
                label="Registered Accounts"
                value={stats.totalUsers}
                detail="All accounts on the platform"
              />
              <StatCard
                label="Active Sessions"
                value={stats.activeSessions}
                detail="Unrevoked sessions that have not expired"
                accent="var(--accounts-good)"
              />
              <StatCard
                label="Matching Accounts"
                value={pagination?.total ?? 0}
                detail={
                  search
                    ? "Accounts matching your search"
                    : "Accounts in the current directory"
                }
                accent="var(--accounts-warning)"
              />
            </div>
          )}

          <LiquidLensSurface
            radius={24}
            intensity="subtle"
            className="mt-8 overflow-hidden border"
            style={{
              padding: 0,
              borderColor: "var(--accounts-border)",
            }}
          >
            <form
              action="/admin/accounts"
              method="GET"
              className="flex min-w-0 flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:p-5"
              style={{ borderColor: "var(--accounts-border)" }}
            >
              <label htmlFor="account-search" className="sr-only">
                Search accounts by name or email
              </label>

              <input
                id="account-search"
                type="search"
                name="search"
                defaultValue={search}
                maxLength={100}
                placeholder="Search by name or email..."
                className="min-h-12 min-w-0 flex-1 rounded-xl border bg-transparent px-4 py-3 text-sm outline-none"
                style={{
                  borderColor: "var(--accounts-border)",
                  color: "var(--accounts-text)",
                }}
              />

              <button
                type="submit"
                className={`${buttonClass} font-semibold text-white`}
                style={{
                  backgroundColor: "var(--accounts-accent)",
                  borderColor: "var(--accounts-accent)",
                }}
              >
                Search Accounts
              </button>

              {search && (
                <Link
                  href="/admin/accounts"
                  className={buttonClass}
                  style={{ borderColor: "var(--accounts-border)" }}
                >
                  Clear
                </Link>
              )}
            </form>

            {loadError ? (
              <div className="p-6 sm:p-8">
                <p className="font-semibold" style={{ color: "#D9534F" }}>
                  Account directory unavailable
                </p>
                <p
                  className="mt-2 text-sm leading-6"
                  style={{ color: "var(--accounts-muted)" }}
                >
                  {loadError}
                </p>
                <Link
                  href="/admin/accounts"
                  className={`${buttonClass} mt-5`}
                  style={{ borderColor: "var(--accounts-border)" }}
                >
                  Try Again
                </Link>
              </div>
            ) : (
              <>
                <div
                  className="flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  style={{ borderColor: "var(--accounts-border)" }}
                >
                  <h2 className="font-semibold">Registered Users</h2>
                  <p
                    className="text-sm"
                    style={{ color: "var(--accounts-muted)" }}
                  >
                    {pagination?.total ?? 0} matching account
                    {(pagination?.total ?? 0) === 1 ? "" : "s"}
                  </p>
                </div>

                <div>
                  {accounts.map((account) => (
                    <article
                      key={account.id}
                      className="flex min-w-0 flex-col gap-5 border-b p-5 last:border-b-0 hover:bg-[var(--accounts-panel)] sm:p-6 xl:flex-row xl:items-start xl:justify-between"
                      style={{ borderColor: "var(--accounts-border)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words font-semibold">
                            {account.name || "Unnamed User"}
                          </h3>

                          <span
                            className="rounded-full border px-2.5 py-1 text-xs"
                            style={{
                              color:
                                account.status === "ONLINE"
                                  ? "var(--accounts-good)"
                                  : "var(--accounts-muted)",
                              borderColor: "var(--accounts-border)",
                              background: "var(--accounts-panel)",
                            }}
                          >
                            <span aria-hidden="true">
                              {account.status === "ONLINE" ? "● " : "○ "}
                            </span>
                            {account.status}
                          </span>

                          <span
                            className="rounded-full border px-2.5 py-1 text-xs"
                            style={{
                              borderColor: "var(--accounts-border)",
                              color: "var(--accounts-muted)",
                            }}
                          >
                            {account.role}
                          </span>
                        </div>

                        <p
                          className="mt-2 break-all text-sm"
                          style={{ color: "var(--accounts-muted)" }}
                        >
                          {account.email}
                        </p>

                        <p
                          className="mt-3 text-xs leading-5"
                          style={{ color: "var(--accounts-muted)" }}
                        >
                          Registered {formatDate(account.createdAt)}
                        </p>

                        {account.portfolioSite ? (
                          <div
                            className="mt-4 rounded-2xl border p-4"
                            style={{
                              borderColor: "var(--accounts-border)",
                              background: "var(--accounts-panel)",
                            }}
                          >
                            <p className="break-words text-sm font-medium">
                              {account.portfolioSite.title || "Untitled portfolio"}
                            </p>
                            <p
                              className="mt-1 break-all text-xs"
                              style={{ color: "var(--accounts-muted)" }}
                            >
                              /p/{account.portfolioSite.slug}
                            </p>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span
                                className="rounded-full border px-2.5 py-1 text-xs"
                                style={{
                                  color: account.portfolioSite.published
                                    ? "var(--accounts-good)"
                                    : "var(--accounts-warning)",
                                  borderColor: "var(--accounts-border)",
                                }}
                              >
                                {account.portfolioSite.published
                                  ? "Published"
                                  : "Draft"}
                              </span>

                              <Link
                                href={`/admin/users/${account.id}/preview`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium hover:opacity-75"
                                style={{ color: "var(--accounts-accent)" }}
                              >
                                Preview portfolio ↗
                              </Link>
                            </div>
                          </div>
                        ) : (
                          <p
                            className="mt-4 text-sm"
                            style={{ color: "var(--accounts-muted)" }}
                          >
                            No portfolio site is linked to this account.
                          </p>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-col gap-3 xl:w-80 xl:shrink-0">
                        <LiquidLensSurface
                          radius={18}
                          intensity="subtle"
                          className="min-w-0 border p-4"
                          style={{ borderColor: "var(--accounts-border)" }}
                        >
                          <p
                            className="text-sm"
                            style={{ color: "var(--accounts-muted)" }}
                          >
                            Active Sessions
                          </p>
                          <p className="mt-1 text-2xl font-semibold tabular-nums">
                            {account.activeSessionCount}
                          </p>

                          {account.sessions.length > 0 ? (
                            <div className="mt-3 space-y-3">
                              {account.sessions.map((session) => (
                                <div
                                  key={session.id}
                                  className="border-t pt-3"
                                  style={{ borderColor: "var(--accounts-border)" }}
                                >
                                  <p className="break-words text-sm font-medium">
                                    {getDeviceLabel(session)}
                                  </p>
                                  <p
                                    className="mt-1 text-xs leading-5"
                                    style={{ color: "var(--accounts-muted)" }}
                                  >
                                    Last active: {formatDate(session.lastActiveAt)}
                                  </p>
                                  <p
                                    className="mt-1 text-xs leading-5"
                                    style={{ color: "var(--accounts-muted)" }}
                                  >
                                    Expires: {formatDate(session.expiresAt)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p
                              className="mt-2 text-xs leading-5"
                              style={{ color: "var(--accounts-muted)" }}
                            >
                              No active sessions recorded.
                            </p>
                          )}
                        </LiquidLensSurface>

                        <Link
                          href={`/admin/users/${account.id}`}
                          className={`${buttonClass} font-semibold text-white`}
                          style={{
                            backgroundColor: "var(--accounts-accent)",
                            borderColor: "var(--accounts-accent)",
                          }}
                        >
                          Manage Account
                        </Link>

                        <Link
                          href="/admin/sessions"
                          className={buttonClass}
                          style={{ borderColor: "var(--accounts-border)" }}
                        >
                          Open Sessions &amp; Devices
                        </Link>
                      </div>
                    </article>
                  ))}

                  {accounts.length === 0 && (
                    <div className="px-5 py-12 text-center sm:px-6">
                      <p className="font-semibold">No matching accounts</p>
                      <p
                        className="mt-2 text-sm"
                        style={{ color: "var(--accounts-muted)" }}
                      >
                        Try another name or email address.
                      </p>
                    </div>
                  )}
                </div>

                {totalPages > 1 && (
                  <nav
                    aria-label="Account pagination"
                    className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 sm:px-6"
                    style={{ borderColor: "var(--accounts-border)" }}
                  >
                    <p
                      className="text-sm"
                      style={{ color: "var(--accounts-muted)" }}
                    >
                      Page {currentPage} of {totalPages}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {currentPage > 1 && (
                        <Link
                          href={pageHref(currentPage - 1)}
                          className={buttonClass}
                          style={{ borderColor: "var(--accounts-border)" }}
                        >
                          ← Previous
                        </Link>
                      )}
                      {currentPage < totalPages && (
                        <Link
                          href={pageHref(currentPage + 1)}
                          className={buttonClass}
                          style={{ borderColor: "var(--accounts-border)" }}
                        >
                          Next →
                        </Link>
                      )}
                    </div>
                  </nav>
                )}
              </>
            )}
          </LiquidLensSurface>
        </section>
      </div>
    </main>
  );
}
