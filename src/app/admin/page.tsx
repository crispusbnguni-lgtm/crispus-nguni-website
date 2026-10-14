
import Link from "next/link";
import { requireSuperAdmin } from "../../lib/authorization";
import { prisma } from "../../lib/prisma";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";
import { DisplayStudioEditor } from "@/components/admin/DisplayStudioEditor";

export const dynamic = "force-dynamic";

const navigationClass =
  "inline-flex min-w-0 max-w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-center text-sm font-medium leading-5 text-white/75 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#126BFF]";

export default async function AdminPage() {
  const admin = await requireSuperAdmin();

  const users = await prisma.user.findMany({
    include: {
      portfolioSite: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const totalUsers = users.length;

  const publishedSites = users.filter(
    (user) => user.portfolioSite?.published,
  ).length;

  const draftSites = totalUsers - publishedSites;

  return (
    <main className="min-h-screen overflow-x-clip px-4 py-6 text-white sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        {/* Header */}
        <header className="flex min-w-0 flex-col gap-6 border-b border-white/10 pb-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <Link
              href="/"
              className="inline-flex max-w-full items-center text-2xl font-semibold tracking-tight transition-opacity duration-300 hover:opacity-75"
            >
              Crispus<span className="text-[#126BFF]">.</span>
            </Link>

            <p className="mt-2 text-sm text-white/40">
              Super Admin Console
            </p>
          </div>

          <nav
            aria-label="Admin navigation"
            className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3"
          >
            <Link
              href="/admin/backgrounds/welcome-page"
              className={`${navigationClass} border-[#126BFF]/25 text-blue-300 hover:border-[#126BFF]/50 hover:bg-[#126BFF]/10`}
            >
              Welcome Page Editor
            </Link>

            <Link
              href="/admin/backgrounds"
              className={`${navigationClass} border-[#D9A441]/25 text-[#D9A441] hover:border-[#D9A441]/50 hover:bg-[#D9A441]/10`}
            >
              Background Library
            </Link>

            <Link
              href="/admin#display-studio"
              className={`${navigationClass} hover:border-[#126BFF]/40 hover:bg-[#126BFF]/10`}
            >
              Display Studio
            </Link>

            <Link
              href="/dashboard"
              className={navigationClass}
            >
              My Dashboard
            </Link>
          </nav>
        </header>

        {/* Overview */}
        <section className="min-w-0 py-10 sm:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D9A441] sm:text-sm sm:tracking-[0.25em]">
            Platform Administration
          </p>

          <h1 className="mt-4 max-w-4xl break-words text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            Welcome, {admin.name || "Super Admin"}.
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/50 sm:text-base sm:leading-8">
            Manage portfolio websites, user accounts, shared appearance,
            and platform-wide display preferences from one secure
            administration area.
          </p>

          {/* Summary cards */}
          <div className="mt-8 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link
              href="/admin/backgrounds/welcome-page"
              className="group block min-w-0 rounded-3xl transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_16px_50px_rgba(0,0,0,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#126BFF]"
            >
              <LiquidLensSurface
                radius={24}
                intensity="medium"
                className="h-full min-w-0 p-5 transition-all duration-300 group-hover:border-[#126BFF]/50 sm:p-6"
                style={{
                  borderColor: "rgba(18,107,255,0.25)",
                }}
              >
                <p className="text-sm font-medium text-blue-300">
                  Website Content
                </p>

                <h2 className="mt-3 break-words text-xl font-semibold leading-snug sm:text-2xl">
                  Welcome Page Editor
                </h2>

                <p className="mt-3 break-words text-sm leading-6 text-white/50">
                  Edit homepage headings, descriptions, buttons,
                  feature sections, and other public website content.
                </p>

                <p className="mt-5 break-words text-sm font-medium leading-5 text-blue-300 transition-colors duration-300 group-hover:text-white">
                  Edit Welcome Page <span aria-hidden="true">→</span>
                </p>
              </LiquidLensSurface>
            </Link>

            <Link
              href="/admin/backgrounds"
              className="group block min-w-0 rounded-3xl transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_16px_50px_rgba(0,0,0,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]"
            >
              <LiquidLensSurface
                radius={24}
                intensity="medium"
                className="h-full min-w-0 p-5 transition-all duration-300 group-hover:border-[#D9A441]/50 sm:p-6"
                style={{
                  borderColor: "rgba(217,164,65,0.22)",
                }}
              >
                <p className="text-sm font-medium text-[#D9A441]">
                  Platform Appearance
                </p>

                <h2 className="mt-3 break-words text-xl font-semibold leading-snug sm:text-2xl">
                  Background Library
                </h2>

                <p className="mt-3 break-words text-sm leading-6 text-white/50">
                  Manage shared background colors and images used
                  across portfolio websites.
                </p>

                <p className="mt-5 break-words text-sm font-medium leading-5 text-[#D9A441] transition-colors duration-300 group-hover:text-white">
                  Open Library <span aria-hidden="true">→</span>
                </p>
              </LiquidLensSurface>
            </Link>

            <LiquidLensSurface
              radius={24}
              intensity="medium"
              className="h-full min-w-0 p-5 transition-all duration-300 hover:-translate-y-1 sm:p-6"
            >
              <p className="text-sm text-white/45">Total Users</p>

              <p className="mt-3 break-words text-4xl font-semibold tabular-nums tracking-tight">
                {totalUsers}
              </p>

              <p className="mt-2 break-words text-sm leading-6 text-white/40">
                Registered portfolio owners
              </p>
            </LiquidLensSurface>

            <LiquidLensSurface
              radius={24}
              intensity="medium"
              className="h-full min-w-0 p-5 transition-all duration-300 hover:-translate-y-1 sm:p-6"
            >
              <p className="text-sm text-white/45">Published Sites</p>

              <p className="mt-3 break-words text-4xl font-semibold tabular-nums tracking-tight text-[#00C98B]">
                {publishedSites}
              </p>

              <p className="mt-2 break-words text-sm leading-6 text-white/40">
                Portfolios currently live
              </p>

              <div className="mt-5 border-t border-white/10 pt-4">
                <p className="text-sm text-white/45">Draft Sites</p>

                <p className="mt-1 text-2xl font-semibold tabular-nums text-[#D9A441]">
                  {draftSites}
                </p>
              </div>
            </LiquidLensSurface>
          </div>

          {/* Display Studio */}
          <section
            id="display-studio"
            className="min-w-0 scroll-mt-8 pt-12"
          >
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#126BFF] sm:text-sm">
                Global Appearance
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Display Studio
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
                Configure shared visual defaults, including glass effects,
                transparency, typography, accessibility, and motion.
              </p>
            </div>

            <DisplayStudioEditor />
          </section>

          {/* Portfolio Accounts */}
          <section className="mt-12 min-w-0">
            <LiquidLensSurface
              radius={24}
              intensity="subtle"
              className="min-w-0 overflow-hidden"
              style={{
                padding: 0,
                borderColor: "rgba(255,255,255,0.1)",
              }}
            >
              <div className="flex min-w-0 flex-col gap-2 border-b border-white/10 px-5 py-5 sm:px-6">
                <h2 className="break-words text-xl font-semibold">
                  Portfolio Accounts
                </h2>

                <p className="break-words text-sm leading-6 text-white/45">
                  Review registered accounts and manage their portfolio
                  websites.
                </p>
              </div>

              <div className="divide-y divide-white/[0.07]">
                {users.map((user) => (
                  <article
                    key={user.id}
                    className="flex min-w-0 flex-col gap-4 px-5 py-5 transition-colors duration-300 hover:bg-white/[0.025] sm:px-6 sm:py-6 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-medium">
                        {user.name || "Unnamed User"}
                      </p>

                      <p className="mt-1 break-all text-sm leading-6 text-white/45">
                        {user.email}
                      </p>

                      {user.portfolioSite && (
                        <p className="mt-2 break-all text-xs text-white/30">
                          /p/{user.portfolioSite.slug}
                        </p>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                      <span className="inline-flex max-w-full items-center break-words rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs leading-5 text-white/55">
                        {user.role}
                      </span>

                      <span
                        className={`inline-flex max-w-full items-center rounded-full border px-3 py-1.5 text-xs leading-5 ${
                          user.portfolioSite?.published
                            ? "border-[#00C98B]/20 bg-[#00C98B]/10 text-[#00C98B]"
                            : "border-[#D9A441]/20 bg-[#D9A441]/10 text-[#D9A441]"
                        }`}
                      >
                        {user.portfolioSite?.published
                          ? "Published"
                          : "Draft"}
                      </span>

                      {user.portfolioSite && (
                        <>
                          <Link
                            href={`/admin/users/${user.id}/preview`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={navigationClass}
                          >
                            Preview
                          </Link>

                          <Link
                            href={`/admin/users/${user.id}`}
                            className="inline-flex min-w-0 max-w-full items-center justify-center rounded-xl border border-[#126BFF]/30 bg-[#126BFF]/90 px-4 py-2.5 text-center text-sm font-semibold leading-5 text-white transition-all duration-300 hover:-translate-y-0.5 hover:border-[#126BFF]/60 hover:bg-[#2477ff] hover:shadow-[0_0_25px_rgba(18,107,255,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#126BFF]"
                          >
                            Manage
                          </Link>
                        </>
                      )}
                    </div>
                  </article>
                ))}

                {users.length === 0 && (
                  <div className="px-5 py-12 text-center sm:px-6">
                    <p className="text-sm text-white/50">
                      No users have registered yet.
                    </p>
                  </div>
                )}
              </div>
            </LiquidLensSurface>
          </section>
        </section>
      </div>
    </main>
  );
}