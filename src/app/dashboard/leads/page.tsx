
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authorization";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";
import { MotionReveal } from "@/components/ui/MotionReveal";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  status?: string;
  temperature?: string;
  source?: string;
  sort?: string;
  page?: string;
}>;

const STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "DISQUALIFIED",
  "CONVERTED",
  "LOST",
] as const;

const TEMPERATURES = ["HOT", "WARM", "COLD", "DORMANT"] as const;

const SOURCES = [
  "WEBSITE",
  "WHATSAPP",
  "FACEBOOK",
  "INSTAGRAM",
  "LINKEDIN",
  "TIKTOK",
  "GOOGLE",
  "REFERRAL",
  "MANUAL",
  "EMAIL",
  "ADVERTISEMENT",
  "OTHER",
] as const;

const PAGE_SIZE = 10;

type LeadRecord = Prisma.LeadGetPayload<{
  select: {
    id: true;
    name: true;
    email: true;
    phone: true;
    company: true;
    interestedIn: true;
    source: true;
    status: true;
    temperature: true;
    score: true;
    createdAt: true;
    nextFollowUpAt: true;
    portfolio: {
      select: {
        name: true;
        slug: true;
        user: {
          select: {
            name: true;
            email: true;
          };
        };
      };
    };
  };
}>;

function label(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function validChoice<T extends readonly string[]>(
  value: string | undefined,
  options: T,
): value is T[number] {
  return Boolean(value && options.includes(value));
}

function makeUrl(
  current: Record<string, string>,
  updates: Record<string, string>,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries({ ...current, ...updates })) {
    if (value) params.set(key, value);
  }

  const query = params.toString();
  return query ? `/dashboard/leads?${query}` : "/dashboard/leads";
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function temperatureClass(temperature: string) {
  switch (temperature) {
    case "HOT":
      return "border-red-400/25 bg-red-400/10 text-red-300";
    case "WARM":
      return "border-amber-400/25 bg-amber-400/10 text-amber-200";
    case "DORMANT":
      return "border-white/10 bg-white/[0.04] text-[var(--text-muted)]";
    default:
      return "border-sky-400/25 bg-sky-400/10 text-sky-200";
  }
}

const glassInput =
  "w-full rounded-xl border border-white/15 bg-white/[0.035] px-3 py-3 text-sm text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none backdrop-blur-2xl backdrop-saturate-150 transition-all duration-300 placeholder:text-[var(--text-muted)] hover:border-white/25 hover:bg-white/[0.055] focus:border-[var(--accent,#D9A441)]/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-[var(--accent,#D9A441)]/10";

const glassButton =
  "liquid-glass-button inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm transition-all duration-300";

const accentText = "text-[var(--accent,#D9A441)]";
const accentBright = "text-[var(--accent-foreground,#E7BD68)]";
const mutedText = "text-[var(--text-muted)]";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const q = (params.q ?? "").trim().slice(0, 100);

  const status = validChoice(params.status, STATUSES)
    ? params.status
    : "";

  const temperature = validChoice(params.temperature, TEMPERATURES)
    ? params.temperature
    : "";

  const source = validChoice(params.source, SOURCES)
    ? params.source
    : "";

  const sort = ["newest", "oldest", "score", "name"].includes(
    params.sort ?? "",
  )
    ? params.sort!
    : "newest";

  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage)
    ? Math.max(1, Math.min(requestedPage, 100000))
    : 1;

  // Regular users only see leads associated with their own portfolio.
  // SUPER_ADMIN can inspect leads across all accounts.
  const where: Prisma.LeadWhereInput = {
    ...(user.role === "SUPER_ADMIN"
      ? {}
      : {
          portfolio: {
            is: {
              userId: user.id,
            },
          },
        }),
    ...(status ? { status: status as (typeof STATUSES)[number] } : {}),
    ...(temperature
      ? { temperature: temperature as (typeof TEMPERATURES)[number] }
      : {}),
    ...(source ? { source: source as (typeof SOURCES)[number] } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
            { interestedIn: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.LeadOrderByWithRelationInput[] =
    sort === "oldest"
      ? [{ createdAt: "asc" }, { id: "asc" }]
      : sort === "score"
        ? [{ score: "desc" }, { createdAt: "desc" }]
        : sort === "name"
          ? [{ name: "asc" }, { createdAt: "desc" }]
          : [{ createdAt: "desc" }, { id: "desc" }];

  const [total, hotCount, qualifiedCount, convertedCount, leads] =
    await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.count({
        where: { ...where, temperature: "HOT" },
      }),
      prisma.lead.count({
        where: { ...where, status: "QUALIFIED" },
      }),
      prisma.lead.count({
        where: { ...where, status: "CONVERTED" },
      }),
      prisma.lead.findMany({
        where,
        orderBy,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          company: true,
          interestedIn: true,
          source: true,
          status: true,
          temperature: true,
          score: true,
          createdAt: true,
          nextFollowUpAt: true,
          portfolio: {
            select: {
              name: true,
              slug: true,
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
    ]);

  // Explicitly type the query result for both desktop and mobile lists.
  const typedLeads: LeadRecord[] = leads;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const queryState: Record<string, string> = {
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    ...(temperature ? { temperature } : {}),
    ...(source ? { source } : {}),
    ...(sort !== "newest" ? { sort } : {}),
  };

  const summaryCards = [
    {
      title: "Matching leads",
      value: total,
      detail: "Current filters",
      accent: "text-[var(--text)]",
      icon: "◎",
    },
    {
      title: "Hot leads",
      value: hotCount,
      detail: "High-priority enquiries",
      accent: "text-red-300",
      icon: "↗",
    },
    {
      title: "Qualified",
      value: qualifiedCount,
      detail: "Ready for next steps",
      accent: accentBright,
      icon: "✓",
    },
    {
      title: "Converted",
      value: convertedCount,
      detail: "Successful outcomes",
      accent: "text-emerald-300",
      icon: "↗",
    },
  ];

  return (
    <main className="relative min-h-screen px-4 py-8 text-[var(--text)] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Page heading */}
        <MotionReveal className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Link
                href="/dashboard"
                className={`text-sm ${mutedText} transition-colors duration-300 hover:text-[var(--accent,#D9A441)]`}
              >
                <span aria-hidden="true">← </span>
                Back to dashboard
              </Link>

              <p
                className={`mt-6 text-xs font-semibold uppercase tracking-[0.25em] ${accentText}`}
              >
                Sales workspace
              </p>

              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Lead inbox
              </h1>

              <p className={`mt-2 max-w-2xl text-sm leading-6 ${mutedText}`}>
                Find enquiries, understand their potential, and keep every
                opportunity moving.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {user.role === "SUPER_ADMIN" && (
                <span
                  className={`liquid-glass inline-flex items-center rounded-full px-3 py-2 text-xs ${accentBright}`}
                >
                  All accounts
                </span>
              )}

              <span className="liquid-glass inline-flex items-center rounded-xl px-4 py-2 text-sm text-[var(--text-muted)]">
                {total} matching lead{total === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </MotionReveal>

        {/* Summary cards */}
        <section
          aria-label="Lead summary"
          className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          {summaryCards.map((item, index) => (
            <MotionReveal
              key={item.title}
              delay={index * 0.06}
              hover
            >
              <LiquidLensSurface
                radius={20}
                intensity="medium"
                className="h-full min-w-0 p-4 transition-colors duration-300 hover:border-white/25 sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className={`text-xs ${mutedText}`}>{item.title}</p>
                  <span
                    aria-hidden="true"
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-base ${item.accent}`}
                  >
                    {item.icon}
                  </span>
                </div>

                <p
                  className={`mt-3 text-2xl font-semibold tabular-nums ${item.accent}`}
                >
                  {item.value}
                </p>

                <p className={`mt-1 text-xs leading-5 ${mutedText}`}>
                  {item.detail}
                </p>
              </LiquidLensSurface>
            </MotionReveal>
          ))}
        </section>

        {/* Search and filters */}
        <MotionReveal delay={0.12} className="mb-6">
          <LiquidLensSurface
            radius={24}
            intensity="medium"
            className="p-4 sm:p-5"
          >
            <form action="/dashboard/leads" method="GET">
              <div className="mb-5 flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] ${accentBright}`}
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-5 w-5"
                  >
                    <circle
                      cx="10.5"
                      cy="10.5"
                      r="6.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="m16 16 4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div>
                  <h2 className="text-sm font-semibold">Find your leads</h2>
                  <p className={`mt-1 text-xs ${mutedText}`}>
                    Refine results by contact, status, source, or score.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                <div className="lg:col-span-2">
                  <label
                    htmlFor="q"
                    className={`mb-2 block text-xs font-medium ${mutedText}`}
                  >
                    Search leads
                  </label>
                  <input
                    id="q"
                    name="q"
                    defaultValue={q}
                    placeholder="Name, email, phone, company…"
                    maxLength={100}
                    className={glassInput}
                  />
                </div>

                <div>
                  <label
                    htmlFor="status"
                    className={`mb-2 block text-xs font-medium ${mutedText}`}
                  >
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={status}
                    className={glassInput}
                  >
                    <option value="">All statuses</option>
                    {STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {label(value)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="temperature"
                    className={`mb-2 block text-xs font-medium ${mutedText}`}
                  >
                    Temperature
                  </label>
                  <select
                    id="temperature"
                    name="temperature"
                    defaultValue={temperature}
                    className={glassInput}
                  >
                    <option value="">All temperatures</option>
                    {TEMPERATURES.map((value) => (
                      <option key={value} value={value}>
                        {label(value)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="source"
                    className={`mb-2 block text-xs font-medium ${mutedText}`}
                  >
                    Source
                  </label>
                  <select
                    id="source"
                    name="source"
                    defaultValue={source}
                    className={glassInput}
                  >
                    <option value="">All sources</option>
                    {SOURCES.map((value) => (
                      <option key={value} value={value}>
                        {label(value)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="sort"
                    className={`mb-2 block text-xs font-medium ${mutedText}`}
                  >
                    Sort by
                  </label>
                  <select
                    id="sort"
                    name="sort"
                    defaultValue={sort}
                    className={glassInput}
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="score">Highest score</option>
                    <option value="name">Name A–Z</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="submit"
                  className={`${glassButton} !border-[var(--accent,#D9A441)]/40 !bg-[var(--accent,#D9A441)]/10 !text-[var(--accent-foreground,#E7BD68)] hover:!bg-[var(--accent,#D9A441)]/20`}
                >
                  Apply filters
                  <span aria-hidden="true">→</span>
                </button>

                <Link href="/dashboard/leads" className={glassButton}>
                  Clear filters
                </Link>
              </div>
            </form>
          </LiquidLensSurface>
        </MotionReveal>

        {/* Lead results */}
        <MotionReveal delay={0.16}>
          <LiquidLensSurface
            radius={24}
            intensity="medium"
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="font-semibold">All leads</h2>
                <p className={`mt-1 text-xs ${mutedText}`}>
                  Page {safePage} of {totalPages}
                </p>
              </div>

              <p className={`text-xs ${mutedText}`}>
                {total} result{total === 1 ? "" : "s"}
              </p>
            </div>

            {typedLeads.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div
                  className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.035] backdrop-blur-xl ${accentText}`}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-6 w-6"
                  >
                    <circle
                      cx="10.5"
                      cy="10.5"
                      r="6.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="m16 16 4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <h3 className="mt-4 font-medium">No matching leads</h3>
                <p
                  className={`mx-auto mt-2 max-w-md text-sm leading-6 ${mutedText}`}
                >
                  Try changing your search or filters. New website enquiries
                  will appear here when submitted.
                </p>

                <Link
                  href="/dashboard/leads"
                  className={`${glassButton} mt-5`}
                >
                  View all leads
                </Link>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[900px] text-left">
                    <thead className="border-b border-white/10 bg-white/[0.02] text-xs text-[var(--text-muted)]">
                      <tr>
                        <th className="px-5 py-4 font-medium">Lead</th>
                        {user.role === "SUPER_ADMIN" && (
                          <th className="px-5 py-4 font-medium">
                            Portfolio owner
                          </th>
                        )}
                        <th className="px-5 py-4 font-medium">Source</th>
                        <th className="px-5 py-4 font-medium">Status</th>
                        <th className="px-5 py-4 font-medium">Temperature</th>
                        <th className="px-5 py-4 font-medium">Score</th>
                        <th className="px-5 py-4 font-medium">Received</th>
                        <th className="px-5 py-4 font-medium">Action</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-white/[0.08]">
                      {typedLeads.map((lead: LeadRecord) => (
                        <tr
                          key={lead.id}
                          className="transition-colors duration-300 hover:bg-white/[0.045]"
                        >
                          <td className="px-5 py-4">
                            <p className="font-medium">{lead.name}</p>
                            <p className={`mt-1 text-xs ${mutedText}`}>
                              {lead.email || lead.phone || "No contact details"}
                            </p>
                            {lead.company && (
                              <p className={`mt-1 text-xs ${mutedText}`}>
                                {lead.company}
                              </p>
                            )}
                          </td>

                          {user.role === "SUPER_ADMIN" && (
                            <td className="px-5 py-4">
                              <p className="text-sm">
                                {lead.portfolio.user.name || lead.portfolio.name}
                              </p>
                              <p className={`mt-1 text-xs ${mutedText}`}>
                                {lead.portfolio.user.email}
                              </p>
                            </td>
                          )}

                          <td className={`px-5 py-4 text-sm ${mutedText}`}>
                            {label(lead.source)}
                          </td>

                          <td className="px-5 py-4">
                            <span className="inline-flex rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                              {label(lead.status)}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${temperatureClass(lead.temperature)}`}
                            >
                              {label(lead.temperature)}
                            </span>
                          </td>

                          <td className="px-5 py-4 font-medium tabular-nums">
                            {lead.score}
                          </td>

                          <td className={`px-5 py-4 text-xs ${mutedText}`}>
                            {formatDate(lead.createdAt)}
                          </td>

                          <td className="px-5 py-4">
                            <Link
                              href={`/dashboard/leads/${lead.id}`}
                              className={`inline-flex whitespace-nowrap text-sm font-medium ${accentBright} transition-colors hover:text-[var(--text)]`}
                            >
                              View lead
                              <span aria-hidden="true" className="ml-1">
                                ↗
                              </span>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile lead cards */}
                <div className="divide-y divide-white/[0.08] lg:hidden">
                  {typedLeads.map((lead: LeadRecord, index: number) => (
                    <MotionReveal
                      key={lead.id}
                      delay={index * 0.035}
                    >
                      <article className="p-4 transition-colors duration-300 hover:bg-white/[0.045] sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate font-semibold">
                              {lead.name}
                            </h3>
                            <p
                              className={`mt-1 break-words text-xs ${mutedText}`}
                            >
                              {lead.email || lead.phone || "No contact details"}
                            </p>
                            {lead.company && (
                              <p className={`mt-1 text-xs ${mutedText}`}>
                                {lead.company}
                              </p>
                            )}
                          </div>

                          <span className="shrink-0 rounded-xl border border-white/15 bg-white/[0.035] px-3 py-2 text-sm font-semibold tabular-nums">
                            {lead.score}
                            <span
                              className={`ml-1 text-[10px] font-normal ${mutedText}`}
                            >
                              pts
                            </span>
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="inline-flex rounded-full border border-white/15 bg-white/[0.035] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                            {label(lead.status)}
                          </span>

                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${temperatureClass(lead.temperature)}`}
                          >
                            {label(lead.temperature)}
                          </span>

                          <span className="inline-flex rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                            {label(lead.source)}
                          </span>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <p className={`text-xs ${mutedText}`}>
                            {formatDate(lead.createdAt)}
                          </p>

                          <Link
                            href={`/dashboard/leads/${lead.id}`}
                            className={`text-sm font-medium ${accentBright} transition-colors hover:text-[var(--text)]`}
                          >
                            View lead
                            <span aria-hidden="true" className="ml-1">
                              ↗
                            </span>
                          </Link>
                        </div>

                        {user.role === "SUPER_ADMIN" && (
                          <p
                            className={`mt-3 break-words text-xs ${mutedText}`}
                          >
                            Owner: {lead.portfolio.user.name || lead.portfolio.name}
                            {" · "}
                            {lead.portfolio.user.email}
                          </p>
                        )}
                      </article>
                    </MotionReveal>
                  ))}
                </div>
              </>
            )}

            {/* Pagination */}
            {total > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-4 sm:px-5">
                <p className={`text-xs ${mutedText}`}>
                  Showing {(safePage - 1) * PAGE_SIZE + 1}–
                  {Math.min(safePage * PAGE_SIZE, total)} of {total}
                </p>

                <div className="flex gap-2">
                  {safePage > 1 ? (
                    <Link
                      href={makeUrl(queryState, {
                        page: String(safePage - 1),
                      })}
                      className={glassButton}
                    >
                      <span aria-hidden="true">← </span>
                      Previous
                    </Link>
                  ) : (
                    <span className="inline-flex cursor-not-allowed items-center rounded-full border border-white/10 px-4 py-2.5 text-sm text-[var(--text-muted)] opacity-50">
                      Previous
                    </span>
                  )}

                  {safePage < totalPages ? (
                    <Link
                      href={makeUrl(queryState, {
                        page: String(safePage + 1),
                      })}
                      className={glassButton}
                    >
                      Next
                      <span aria-hidden="true"> →</span>
                    </Link>
                  ) : (
                    <span className="inline-flex cursor-not-allowed items-center rounded-full border border-white/10 px-4 py-2.5 text-sm text-[var(--text-muted)] opacity-50">
                      Next
                    </span>
                  )}
                </div>
              </div>
            )}
          </LiquidLensSurface>
        </MotionReveal>
      </div>
    </main>
  );
}