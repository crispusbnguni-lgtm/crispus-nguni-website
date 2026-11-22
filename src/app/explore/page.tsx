
import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/navigation/Navbar";
import { PortfolioImage } from "@/components/portfolio/PortfolioImage";
import { prisma } from "@/lib/prisma";
import { parseExploreQuery, resolveExplorePage, type ExploreFilters, type ExploreQueryInput } from "@/lib/portfolio-public";
import { getWelcomeBackgroundSettings } from "@/lib/welcome-page-background";
import { LensGlass } from "@/components/ui/LensGlass";
import WelcomePageBackground from "@/components/welcome-page/WelcomePageBackground";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explore Portfolios | Crispus",
  description:
    "Discover professionals, explore expertise and connect with exceptional talent.",
};

const PAGE_SIZE = 12;

type ExplorePageProps = {
  searchParams: Promise<ExploreQueryInput>;
};

function makePageUrl(
  values: ExploreFilters,
  page: number
) {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/explore?${query}` : "/explore";
}

export default async function ExplorePage({
  searchParams,
}: ExplorePageProps) {
  const params = await searchParams;
  const { filters, requestedPage, invalid: invalidQuery } = parseExploreQuery(params);

  const publicPortfolio = {
    published: true,
    visibility: "PUBLIC" as const,
  };

  const andConditions: object[] = [];

  if (filters.location) {
    andConditions.push({
      location: {
        contains: filters.location,
        mode: "insensitive" as const,
      },
    });
  }

  if (filters.skill) {
    andConditions.push({
      showSkills: true,
      skills: {
        some: {
          name: {
            contains: filters.skill,
            mode: "insensitive" as const,
          },
        },
      },
    });
  }

  if (filters.education) {
    andConditions.push({
      showEducation: true,
      education: {
        some: {
          institution: {
            contains: filters.education,
            mode: "insensitive" as const,
          },
        },
      },
    });
  }

  if (filters.experience) {
    andConditions.push({
      showExperience: true,
      experiences: {
        some: {
          OR: [
            {
              jobTitle: {
                contains: filters.experience,
                mode: "insensitive" as const,
              },
            },
            {
              company: {
                contains: filters.experience,
                mode: "insensitive" as const,
              },
            },
          ],
        },
      },
    });
  }

  if (filters.project) {
    andConditions.push({
      showProjects: true,
      projects: {
        some: {
          OR: [
            {
              category: {
                contains: filters.project,
                mode: "insensitive" as const,
              },
            },
            {
              title: {
                contains: filters.project,
                mode: "insensitive" as const,
              },
            },
          ],
        },
      },
    });
  }

  if (filters.q) {
    const term = filters.q;

    const searchConditions: object[] = [
      {
        name: {
          contains: term,
          mode: "insensitive" as const,
        },
      },
      {
        title: {
          contains: term,
          mode: "insensitive" as const,
        },
      },
      {
        location: {
          contains: term,
          mode: "insensitive" as const,
        },
      },
      {
        AND: [
          { showAbout: true },
          {
            bio: {
              contains: term,
              mode: "insensitive" as const,
            },
          },
        ],
      },
      {
        AND: [
          { showSkills: true },
          {
            skills: {
              some: {
                OR: [
                  {
                    name: {
                      contains: term,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    category: {
                      contains: term,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    description: {
                      contains: term,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              },
            },
          },
        ],
      },
      {
        AND: [
          { showEducation: true },
          {
            education: {
              some: {
                OR: [
                  {
                    institution: {
                      contains: term,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    degree: {
                      contains: term,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    field: {
                      contains: term,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              },
            },
          },
        ],
      },
      {
        AND: [
          { showExperience: true },
          {
            experiences: {
              some: {
                OR: [
                  {
                    jobTitle: {
                      contains: term,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    company: {
                      contains: term,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    description: {
                      contains: term,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              },
            },
          },
        ],
      },
      {
        AND: [
          { showProjects: true },
          {
            projects: {
              some: {
                OR: [
                  {
                    title: {
                      contains: term,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    description: {
                      contains: term,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    category: {
                      contains: term,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    technologies: {
                      contains: term,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              },
            },
          },
        ],
      },
      {
        AND: [
          { showServices: true },
          {
            services: {
              some: {
                OR: [
                  {
                    title: {
                      contains: term,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    description: {
                      contains: term,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    ];

    andConditions.push({
      OR: searchConditions,
    });
  }

  const where = {
    ...publicPortfolio,
    ...(andConditions.length > 0
      ? { AND: andConditions }
      : {}),
  };

  const backgroundPromise = getWelcomeBackgroundSettings({
    publishedOnly: true,
  });

  const countPromise = prisma.portfolioSite.count({ where });

  const locationsPromise = prisma.portfolioSite.findMany({
    where: {
      ...publicPortfolio,
      location: { not: null },
    },
    select: { location: true },
    distinct: ["location"],
    orderBy: { location: "asc" },
    take: 100,
  });

  const skillsPromise = prisma.skill.findMany({
    where: {
      portfolio: {
        ...publicPortfolio,
        showSkills: true,
      },
    },
    select: { name: true },
    distinct: ["name"],
    orderBy: { name: "asc" },
    take: 100,
  });

  const educationPromise = prisma.education.findMany({
    where: {
      portfolio: {
        ...publicPortfolio,
        showEducation: true,
      },
    },
    select: { institution: true },
    distinct: ["institution"],
    orderBy: { institution: "asc" },
    take: 100,
  });

  const experiencePromise = prisma.experience.findMany({
    where: {
      portfolio: {
        ...publicPortfolio,
        showExperience: true,
      },
    },
    select: { jobTitle: true },
    distinct: ["jobTitle"],
    orderBy: { jobTitle: "asc" },
    take: 100,
  });

  const projectsPromise = prisma.project.findMany({
    where: {
      portfolio: {
        ...publicPortfolio,
        showProjects: true,
      },
      category: { not: null },
    },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
    take: 100,
  });

  const [
    totalCount,
    locations,
    skills,
    education,
    experiences,
    projects,
    background,
  ] = await Promise.all([
    countPromise,
    locationsPromise,
    skillsPromise,
    educationPromise,
    experiencePromise,
    projectsPromise,
    backgroundPromise,
  ]);

  const { currentPage, totalPages, skip } = resolveExplorePage(
    requestedPage,
    totalCount,
    PAGE_SIZE,
  );

  const portfolios = await prisma.portfolioSite.findMany({
    where,
    select: {
      id: true,
      name: true,
      title: true,
      bio: true,
      profileImage: true,
      location: true,
      slug: true,
      showAbout: true,
      showSkills: true,
      skills: {
        take: 3,
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { id: true, name: true },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip,
    take: PAGE_SIZE,
  });

  const activeFilters = Object.values(filters).filter(Boolean).length;

  const backgroundImage = background.backgroundImage;
  const accentColor = background.accentColor;
  const backgroundColor = background.backgroundColor;

  return (
    <main
      className="crispus-public-page relative min-h-screen overflow-hidden text-white"
      style={{
        backgroundColor: "var(--bg)",
        ["--explore-accent" as string]: accentColor,
      }}
    >
      <WelcomePageBackground
        backgroundImage={backgroundImage}
        backgroundColor={backgroundColor}
        backgroundPosition={background.backgroundPosition}
      />

      {/* GLOBAL NAVIGATION */}
      <Navbar />

      {/* EXPLORE CONTENT */}
      <div className="reader-content relative z-10 mx-auto max-w-7xl px-5 pt-32 pb-8 sm:px-8 sm:pt-36 lg:px-12">

        {/* HERO */}
        <section className="mb-14 max-w-4xl">
          <p
            className="mb-5 text-xs font-bold uppercase tracking-[0.3em]"
            style={{ color: accentColor }}
          >
            The professional discovery platform
          </p>

          <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
            Discover talent.
            <span className="block bg-gradient-to-r from-white via-white/80 to-white/35 bg-clip-text text-transparent">
              Explore possibilities.
            </span>
          </h1>

          <p className="mt-7 max-w-2xl text-base leading-8 text-white/60 sm:text-lg">
            Explore professional journeys, expertise, education,
            experience and exceptional work in one place.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-5 text-sm text-white/50">
            <span>
              <strong className="text-white">{totalCount}</strong>{" "}
              discoverable {totalCount === 1 ? "portfolio" : "portfolios"}
            </span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span>Public professional profiles</span>
          </div>
        </section>

        {/* SEARCH AND FILTERS */}
        <section aria-label="Search and filter portfolios" className="mb-12">
          <LensGlass
            radius={28}
            className="p-5 sm:p-7"
            optics={{ strength: 0.14, dispersion: 0.05, frost: 1 }}
          >
            <form action="/explore" method="get">
              <label
                htmlFor="portfolio-search"
                className="mb-3 block text-sm font-semibold text-white/80"
              >
                Search the professional community
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="portfolio-search"
                  name="q"
                  defaultValue={filters.q}
                  placeholder="Search names, skills, companies, projects..."
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-5 py-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/30 focus:ring-2 focus:ring-white/10"
                />

                <button
                  type="submit"
                  className="rounded-xl px-8 py-4 text-sm font-bold text-white transition duration-300 hover:-translate-y-0.5 hover:brightness-110"
                  style={{ backgroundColor: accentColor }}
                >
                  Search portfolios
                </button>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <select
                  name="location"
                  defaultValue={filters.location}
                  aria-label="Filter by location"
                  className="rounded-xl border border-white/10 bg-[#101522]/90 px-4 py-3 text-sm text-white outline-none focus:border-white/30"
                >
                  <option value="">All locations</option>
                  {locations.map((item) =>
                    item.location ? (
                      <option key={item.location} value={item.location}>
                        {item.location}
                      </option>
                    ) : null
                  )}
                </select>

                <select
                  name="skill"
                  defaultValue={filters.skill}
                  aria-label="Filter by skill"
                  className="rounded-xl border border-white/10 bg-[#101522]/90 px-4 py-3 text-sm text-white outline-none focus:border-white/30"
                >
                  <option value="">All skills</option>
                  {skills.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>

                <select
                  name="education"
                  defaultValue={filters.education}
                  aria-label="Filter by institution"
                  className="rounded-xl border border-white/10 bg-[#101522]/90 px-4 py-3 text-sm text-white outline-none focus:border-white/30"
                >
                  <option value="">All institutions</option>
                  {education.map((item) => (
                    <option key={item.institution} value={item.institution}>
                      {item.institution}
                    </option>
                  ))}
                </select>

                <select
                  name="experience"
                  defaultValue={filters.experience}
                  aria-label="Filter by experience"
                  className="rounded-xl border border-white/10 bg-[#101522]/90 px-4 py-3 text-sm text-white outline-none focus:border-white/30"
                >
                  <option value="">All professional roles</option>
                  {experiences.map((item) => (
                    <option key={item.jobTitle} value={item.jobTitle}>
                      {item.jobTitle}
                    </option>
                  ))}
                </select>

                <select
                  name="project"
                  defaultValue={filters.project}
                  aria-label="Filter by project category"
                  className="rounded-xl border border-white/10 bg-[#101522]/90 px-4 py-3 text-sm text-white outline-none focus:border-white/30"
                >
                  <option value="">All project categories</option>
                  {projects.map((item) =>
                    item.category ? (
                      <option key={item.category} value={item.category}>
                        {item.category}
                      </option>
                    ) : null
                  )}
                </select>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-white/40">
                  Combine filters to narrow your discovery.
                </p>

                <Link
                  href="/explore"
                  className="text-xs font-semibold text-white/60 underline decoration-white/20 underline-offset-4 transition hover:text-white"
                >
                  Clear all filters
                </Link>
              </div>
            </form>
          </LensGlass>
        </section>

        {invalidQuery && (
          <p role="status" className="mb-6 rounded-xl border border-amber-200/15 bg-amber-100/[0.05] px-4 py-3 text-sm text-amber-100/75">
            Some search values were invalid and have been cleared.
          </p>
        )}

        {/* RESULTS HEADER */}
        <section className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
              Portfolio directory
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {filters.q || activeFilters > 0
                ? "Matching professionals"
                : "Explore professionals"}
            </h2>
          </div>

          <p className="text-sm text-white/45">
            Showing {portfolios.length} of {totalCount}
          </p>
        </section>

        {/* PORTFOLIO CARDS */}
        {portfolios.length > 0 ? (
          <section
            aria-label="Public professional portfolios"
            className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {portfolios.map((portfolio, index) => (
              <Link
                key={portfolio.id}
                href={`/p/${portfolio.slug}`}
                className="group block h-full w-full min-w-0 overflow-hidden rounded-3xl outline-none transition duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-white/60"
                style={{
                  animation: "exploreFadeUp 550ms ease both",
                  animationDelay: `${Math.min(index * 65, 390)}ms`,
                }}
              >
                <LensGlass
                  radius={26}
                  className="h-full w-full min-w-0 transition duration-300 group-hover:border-white/30"
                  optics={{ strength: 0.13, dispersion: 0.045 }}
                >
                  <div className="flex h-full w-full min-w-0 flex-col p-7">

                    <div className="mb-7 flex items-center gap-4">
                      <div className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/[0.07]">
                        <PortfolioImage
                          src={portfolio.profileImage}
                          alt={portfolio.name}
                          className="object-cover transition duration-500 group-hover:scale-110"
                          sizes="68px"
                          fallback={(
                            <span className="text-2xl font-semibold" style={{ color: accentColor }} aria-hidden="true">
                              {portfolio.name.trim().charAt(0).toUpperCase() || "•"}
                            </span>
                          )}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-lg font-semibold text-white">
                          {portfolio.name}
                        </h3>
                        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                          Public portfolio
                        </p>
                      </div>

                      <span
                        aria-hidden="true"
                        className="text-xl text-white/30 transition duration-300 group-hover:translate-x-1 group-hover:text-white"
                      >
                        ↗
                      </span>
                    </div>

                    <h4 className="text-base font-semibold leading-7 text-white/90">
                      {portfolio.title}
                    </h4>

                    <p className="mt-3 min-h-[72px] text-sm leading-6 text-white/55">
                      {portfolio.showAbout && portfolio.bio?.trim()
                        ? portfolio.bio
                        : "Explore this professional's experience, expertise and work."}
                    </p>

                    {portfolio.showSkills && portfolio.skills.length > 0 && (
                      <div className="mt-5 flex flex-wrap gap-2">
                        {portfolio.skills.map((skill) => (
                          <span
                            key={skill.id}
                            className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] text-white/65"
                          >
                            {skill.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-5">
                      <span className="text-xs text-white/45">
                        {portfolio.location || "Professional profile"}
                      </span>

                      <span
                        className="text-sm font-semibold transition group-hover:translate-x-1"
                        style={{ color: accentColor }}
                      >
                        View portfolio →
                      </span>
                    </div>
                  </div>
                </LensGlass>
              </Link>
            ))}
          </section>
        ) : (
          <LensGlass radius={28} className="px-6 py-20 text-center">
            <div
              className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
              style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
            >
              ✦
            </div>

            <h2 className="text-2xl font-semibold">
              No matching portfolios found.
            </h2>

            <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-white/55">
              Try another search term or remove some filters to discover more
              professionals.
            </p>

            <Link
              href="/explore"
              className="mt-8 inline-flex rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
              style={{ backgroundColor: accentColor }}
            >
              Clear search and filters
            </Link>
          </LensGlass>
        )}

        {/* PAGINATION */}
        {totalPages > 1 && (
          <nav
            aria-label="Portfolio pages"
            className="mt-12 flex flex-wrap items-center justify-center gap-3"
          >
            {currentPage > 1 && (
              <Link
                href={makePageUrl(filters, currentPage - 1)}
                className="rounded-xl border border-white/15 bg-white/[0.05] px-5 py-3 text-sm transition hover:bg-white/10"
              >
                ← Previous
              </Link>
            )}

            <span className="px-4 text-sm text-white/55">
              Page {currentPage} of {totalPages}
            </span>

            {currentPage < totalPages && (
              <Link
                href={makePageUrl(filters, currentPage + 1)}
                className="rounded-xl border border-white/15 bg-white/[0.05] px-5 py-3 text-sm transition hover:bg-white/10"
              >
                Next →
              </Link>
            )}
          </nav>
        )}

        {/* FOOTER */}
        <footer className="mt-24 border-t border-white/10 py-9 text-center text-sm text-white/40">
          © {new Date().getFullYear()} Crispus. All rights reserved.
        </footer>
      </div>

      <style>{`
        @keyframes exploreFadeUp {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </main>
  );
}
