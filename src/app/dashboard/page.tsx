
import Link from "next/link";
import type { CSSProperties } from "react";
import type { Prisma } from "@prisma/client";
import { requireUser } from "../../lib/authorization";
import { prisma } from "../../lib/prisma";
import { LogoutButton } from "../../components/auth/LogoutButton";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";
import {
  MotionCard,
  MotionCount,
  MotionReveal,
  MotionArrow,
} from "@/components/dashboard/DashboardMotion";

type DashboardLead = Prisma.LeadGetPayload<Record<string, never>>;

const glassCard =
  "group relative min-w-0 overflow-hidden rounded-3xl motion-reduce:transform-none motion-reduce:transition-none";

const glassButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.055] px-4 py-2.5 text-sm font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_18px_rgba(0,0,0,0.06)] backdrop-blur-2xl transition-[transform,background-color,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.11] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_8px_24px_rgba(0,0,0,0.12)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#126BFF] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent motion-reduce:transform-none motion-reduce:transition-none";

function DashboardIcon({
  name,
}: {
  name:
    | "portfolio"
    | "leads"
    | "calendar"
    | "arrow"
    | "people"
    | "settings";
}) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "portfolio") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        aria-hidden="true"
        {...common}
      >
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M8 4V2.8h8V4M3 10h18M9 10v2h6v-2" />
      </svg>
    );
  }

  if (name === "leads" || name === "people") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        aria-hidden="true"
        {...common}
      >
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.8 20v-1.5A5.2 5.2 0 0 1 8 13.3h2a5.2 5.2 0 0 1 5.2 5.2V20M16 4.8a3.5 3.5 0 0 1 0 6.5M17 14h.8a4.4 4.4 0 0 1 4.4 4.4V20" />
      </svg>
    );
  }

  if (name === "calendar") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        aria-hidden="true"
        {...common}
      >
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 17h2" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        aria-hidden="true"
        {...common}
      >
        <circle cx="12" cy="12" r="3" />
        <path d="m19.4 15 .1.1 1.1 1.1-2.8 2.8-1.2-1.2a7.7 7.7 0 0 1-2 .8V20h-4v-1.4a7.7 7.7 0 0 1-2-.8l-1.2 1.2-2.8-2.8 1.1-1.2a7.7 7.7 0 0 1-.8-2H3v-4h1.9a7.7 7.7 0 0 1 .8-2L4.6 5.8l2.8-2.8 1.2 1.2a7.7 7.7 0 0 1 2-.8V2h4v1.4a7.7 7.7 0 0 1 2 .8l1.2-1.2 2.8 2.8-1.1 1.2a7.7 7.7 0 0 1 .8 2H22v4h-1.9a7.7 7.7 0 0 1-.7 2Z" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      aria-hidden="true"
      {...common}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();

  const portfolio = await prisma.portfolioSite.findUnique({
    where: {
      userId: user.id,
    },
    include: {
      leads: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  const leads: DashboardLead[] = portfolio?.leads ?? [];

  const totalLeads = leads.length;
  const hotLeads = leads.filter(
    (lead) => lead.temperature === "HOT",
  ).length;
  const qualifiedLeads = leads.filter(
    (lead) => lead.status === "QUALIFIED",
  ).length;
  const convertedLeads = leads.filter(
    (lead) => lead.status === "CONVERTED",
  ).length;

  const statistics = [
    {
      label: "Total Leads",
      value: totalLeads,
      detail: "People who contacted you",
      color: "#60A5FA",
      icon: "people" as const,
    },
    {
      label: "Hot Leads",
      value: hotLeads,
      detail: "Require your attention",
      color: "#FF7777",
      icon: "leads" as const,
    },
    {
      label: "Qualified",
      value: qualifiedLeads,
      detail: "Potential opportunities",
      color: "#D9A441",
      icon: "portfolio" as const,
    },
    {
      label: "Converted",
      value: convertedLeads,
      detail: "Successful conversions",
      color: "#34D399",
      icon: "calendar" as const,
    },
  ];

  const navigationCards = [
    {
      href: "/dashboard/portfolio",
      category: "YOUR ONLINE PRESENCE",
      title: "Manage Portfolio",
      description:
        "Edit your professional profile, services, experience, projects, testimonials and public content.",
      action: "Open portfolio manager",
      accent: "#60A5FA",
      icon: "portfolio" as const,
    },
    {
      href: "/dashboard/leads",
      category: "CLIENT RELATIONSHIPS",
      title: "Manage Leads",
      description:
        "Review enquiries, qualify prospects, track follow-ups and manage potential clients.",
      action: "Open lead inbox",
      accent: "#34D399",
      icon: "leads" as const,
    },
    {
      href: "/dashboard/consultations",
      category: "YOUR SCHEDULE",
      title: "Consultations",
      description:
        "Review booking requests, confirm appointments, manage cancellations and track activity.",
      action: "Open consultations",
      accent: "#D9A441",
      icon: "calendar" as const,
    },
  ];

  return (
    <main className="relative min-h-screen overflow-x-clip bg-transparent px-4 py-5 text-[var(--text)] transition-colors duration-300 motion-reduce:transition-none sm:px-6 sm:py-8 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] overflow-hidden">
        <div className="absolute -left-40 top-0 h-80 w-80 rounded-full bg-[#126BFF]/[0.07] blur-[100px]" />
        <div className="absolute -right-32 top-20 h-72 w-72 rounded-full bg-[#D9A441]/[0.055] blur-[100px]" />
      </div>

      <div className="mx-auto w-full max-w-7xl">
        {/* Workspace header */}
        <MotionReveal y={-12}>
          <LiquidLensSurface
            radius={24}
            className="relative flex min-w-0 flex-col gap-5 rounded-3xl p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="min-w-0">
              <Link
                href="/"
                className="inline-flex items-center rounded-lg text-2xl font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#126BFF]"
              >
                Crispus<span className="text-[#126BFF]">.</span>
              </Link>

              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Professional Workspace
              </p>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
              <Link
                href="/dashboard/display-studio"
                className={`${glassButton} text-[#D9A441]`}
              >
                <DashboardIcon name="settings" />
                Display Studio
              </Link>
              <Link
  href="/dashboard/security/sessions"
  className={glassButton}
>
  Sessions &amp; Devices
</Link>

              <NotificationBell />

              {portfolio && (
                <Link
                  href={`/p/${portfolio.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={glassButton}
                >
                  View Website
                  <MotionArrow>
                    <DashboardIcon name="arrow" />
                  </MotionArrow>
                </Link>
              )}

              {user.role === "SUPER_ADMIN" && (
                <Link
                  href="/admin"
                  className={`${glassButton} text-[#D9A441]`}
                >
                  Admin Console
                  <MotionArrow>
                    <DashboardIcon name="arrow" />
                  </MotionArrow>
                </Link>
              )}

              <LogoutButton />
            </div>
          </LiquidLensSurface>
        </MotionReveal>

        <section className="py-8 sm:py-12">
          {/* Welcome hero */}
          <MotionReveal delay={0.08} y={24}>
            <LiquidLensSurface
              radius={32}
              intensity="strong"
              className="relative overflow-hidden rounded-[2rem] p-6 sm:p-9 lg:p-12"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.045] via-transparent to-[#126BFF]/[0.045]"
              />

              <div className="relative min-w-0">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full border border-white/[0.12] shadow-[inset_0_0_50px_rgba(255,255,255,0.025)]"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute right-16 top-12 h-32 w-32 rounded-full border border-white/[0.12]"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-28 right-24 h-52 w-52 rounded-full bg-[#126BFF]/[0.07] blur-3xl"
                />

                <div className="relative max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#D9A441]/25 bg-[#D9A441]/[0.055] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#D9A441]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#D9A441] shadow-[0_0_10px_rgba(217,164,65,0.65)]" />
                    My Workspace
                  </div>

                  <h1 className="mt-5 break-words text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                    Welcome, {user.name || "Professional"}.
                  </h1>

                  <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-muted)] sm:text-lg sm:leading-8">
                    Your professional presence, client relationships and
                    opportunities, brought together in one workspace.
                  </p>

                  <div className="mt-7 flex flex-wrap gap-3">
                    <Link
                      href="/dashboard/portfolio"
                      className={`${glassButton} border-[#126BFF]/30 bg-[#126BFF]/[0.10] hover:border-[#126BFF]/50 hover:bg-[#126BFF]/[0.16]`}
                    >
                      Manage your website
                      <MotionArrow>
                        <DashboardIcon name="arrow" />
                      </MotionArrow>
                    </Link>

                    <Link href="/dashboard/leads" className={glassButton}>
                      Explore leads
                    </Link>
                  </div>
                </div>
              </div>
            </LiquidLensSurface>
          </MotionReveal>

          {/* Animated statistics */}
          <div className="mt-6 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statistics.map((stat, index) => (
              <MotionCard key={stat.label} delay={index * 0.07}>
                <LiquidLensSurface
                  radius={24}
                  intensity="subtle"
                  className={`${glassCard} h-full p-5 sm:p-6`}
                  style={
                    {
                      "--stat-accent": stat.color,
                    } as CSSProperties
                  }
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-5 top-0 h-px opacity-70"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${stat.color}70, transparent)`,
                    }}
                  />

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-muted)]">
                        {stat.label}
                      </p>

                      <MotionCount
                        value={stat.value}
                        className="mt-3 block text-4xl font-semibold tracking-tight tabular-nums"
                      />
                    </div>

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--stat-accent)]/25 bg-[var(--stat-accent)]/[0.10] text-[var(--stat-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                      <DashboardIcon name={stat.icon} />
                    </div>
                  </div>

                  <p className="mt-4 text-sm text-[var(--text-muted)]">
                    {stat.detail}
                  </p>

                  <div className="mt-5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full w-1/3 origin-left rounded-full"
                      style={{
                        background: stat.color,
                        boxShadow: `0 0 12px ${stat.color}55`,
                      }}
                    />
                  </div>
                </LiquidLensSurface>
              </MotionCard>
            ))}
          </div>

          {/* Workspace tools */}
          <MotionReveal delay={0.05} y={18}>
            <div className="mt-12">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                    Workspace tools
                  </p>

                  <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                    Everything in one place
                  </h2>
                </div>

                <p className="text-sm text-[var(--text-muted)]">
                  Choose a workspace to get started
                </p>
              </div>

              <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-3">
                {navigationCards.map((card, index) => (
                  <MotionCard key={card.href} delay={index * 0.09}>
                    <LiquidLensSurface
                      radius={24}
                      className={`${glassCard} h-full p-0 transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-white/25 hover:shadow-[0_20px_55px_rgba(0,0,0,0.16)] motion-reduce:transform-none motion-reduce:transition-none`}
                      style={
                        {
                          "--card-accent": card.accent,
                        } as CSSProperties
                      }
                    >
                      <Link
                        href={card.href}
                        className="relative flex h-full min-h-[270px] flex-col rounded-3xl p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#126BFF] sm:p-7"
                      >
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-60 motion-reduce:transition-none"
                          style={{ background: card.accent }}
                        />

                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-x-6 top-0 h-px opacity-60"
                          style={{
                            background: `linear-gradient(90deg, transparent, ${card.accent}70, transparent)`,
                          }}
                        />

                        <div className="relative flex items-start justify-between gap-3">
                          <div
                            className="flex h-12 w-12 items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-transform duration-300 group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none"
                            style={{
                              color: card.accent,
                              borderColor: `${card.accent}40`,
                              background: `${card.accent}12`,
                            }}
                          >
                            <DashboardIcon name={card.icon} />
                          </div>

                          <span className="rounded-full border border-white/[0.12] bg-white/[0.025] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                            Open
                          </span>
                        </div>

                        <div className="relative mt-6">
                          <p
                            className="text-[11px] font-semibold tracking-[0.18em]"
                            style={{ color: card.accent }}
                          >
                            {card.category}
                          </p>

                          <h3 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
                            {card.title}
                          </h3>

                          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                            {card.description}
                          </p>
                        </div>

                        <div
                          className="relative mt-auto flex items-center gap-2 pt-6 text-sm font-medium"
                          style={{ color: card.accent }}
                        >
                          {card.action}

                          <MotionArrow>
                            <DashboardIcon name="arrow" />
                          </MotionArrow>
                        </div>
                      </Link>
                    </LiquidLensSurface>
                  </MotionCard>
                ))}
              </div>
            </div>
          </MotionReveal>

          {/* Recent leads */}
          <MotionReveal delay={0.08} y={20}>
            <LiquidLensSurface
              radius={24}
              className={`${glassCard} mt-12 !translate-y-0`}
            >
              <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Client activity
                  </p>

                  <h2 className="mt-2 text-xl font-semibold sm:text-2xl">
                    Recent Leads
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                    The latest people who have interacted with your professional
                    website.
                  </p>
                </div>

                <Link href="/dashboard/leads" className={glassButton}>
                  View all leads
                  <MotionArrow>
                    <DashboardIcon name="arrow" />
                  </MotionArrow>
                </Link>
              </div>

              {leads.length > 0 ? (
                <div>
                  {leads.slice(0, 8).map((lead, index) => (
                    <MotionReveal key={lead.id} delay={index * 0.035} y={10}>
                      <div className="flex min-w-0 flex-col gap-4 border-t border-white/[0.08] px-5 py-5 transition-colors duration-300 hover:bg-white/[0.035] motion-reduce:transition-none sm:px-6 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <p className="break-words font-medium">
                            {lead.name}
                          </p>

                          <p className="mt-1 break-words text-sm text-[var(--text-muted)]">
                            {lead.email}
                            {lead.company ? ` · ${lead.company}` : ""}
                          </p>
                        </div>

                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="max-w-full break-words rounded-full border border-white/[0.12] bg-white/[0.025] px-3 py-1.5 text-xs text-[var(--text-muted)]">
                            {lead.source}
                          </span>

                          <span
                            className={`rounded-full border px-3 py-1.5 text-xs ${
                              lead.temperature === "HOT"
                                ? "border-[#FF6B6B]/25 bg-[#FF6B6B]/[0.06] text-[#FF8A8A]"
                                : lead.temperature === "WARM"
                                  ? "border-[#D9A441]/25 bg-[#D9A441]/[0.06] text-[#D9A441]"
                                  : "border-white/[0.12] text-[var(--text-muted)]"
                            }`}
                          >
                            {lead.temperature}
                          </span>

                          <span className="rounded-full border border-white/[0.12] px-3 py-1.5 text-xs text-[var(--text-muted)]">
                            {lead.status}
                          </span>
                        </div>
                      </div>
                    </MotionReveal>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-14 text-center sm:py-16">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.025] text-[var(--text-muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <DashboardIcon name="leads" />
                  </div>

                  <h3 className="mt-4 font-semibold">
                    Your leads will appear here
                  </h3>

                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-muted)]">
                    When someone submits an enquiry through your professional
                    website, their details and lead status will appear here.
                  </p>

                  {portfolio && (
                    <Link
                      href={`/p/${portfolio.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${glassButton} mt-5`}
                    >
                      View your website
                      <MotionArrow>
                        <DashboardIcon name="arrow" />
                      </MotionArrow>
                    </Link>
                  )}
                </div>
              )}
            </LiquidLensSurface>
          </MotionReveal>
        </section>
      </div>
    </main>
  );
}