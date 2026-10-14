type Insight = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  category: string | null;
  published: boolean;
  featured: boolean;
  publishedAt: Date | string | null;
};

type InsightsSectionProps = {
  insights: Insight[];
};

function formatDate(date: Date | string | null) {
  if (!date) {
    return null;
  }

  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function InsightsSection({
  insights,
}: InsightsSectionProps) {
  const publishedInsights = insights.filter(
    (insight) => insight.published
  );

  if (publishedInsights.length === 0) {
    return null;
  }

  const featuredInsights = publishedInsights.filter(
    (insight) => insight.featured
  );

  const regularInsights = publishedInsights.filter(
    (insight) => !insight.featured
  );

  const orderedInsights = [
    ...featuredInsights,
    ...regularInsights,
  ];

  return (
    <section
      id="insights"
      className="relative overflow-hidden border-t border-white/5 px-6 py-24 sm:py-32"
    >
      <div className="pointer-events-none absolute right-0 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-[#126BFF]/10 blur-[140px]" />

      <div className="relative mx-auto max-w-7xl">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-[#D9A441]">
          Insights
        </p>

        <div className="mt-5 max-w-3xl">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Insights & Articles
          </h2>

          <p className="mt-6 text-lg leading-8 text-white/50">
            Ideas, perspectives and professional knowledge worth exploring.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {orderedInsights.map((insight) => (
            <article
              key={insight.id}
              className={`group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-xl transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05] ${
                insight.featured
                  ? "md:col-span-2 lg:col-span-2"
                  : ""
              }`}
            >
              {insight.coverImage ? (
                <div
                  className={`relative overflow-hidden bg-[#071A46] ${
                    insight.featured
                      ? "aspect-[16/8]"
                      : "aspect-[16/10]"
                  }`}
                >
                  <img
                    src={insight.coverImage}
                    alt={insight.title}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-[#05070D]/80 via-transparent to-transparent" />
                </div>
              ) : (
                <div
                  className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#071A46] via-[#0b1230] to-[#05070D] ${
                    insight.featured
                      ? "aspect-[16/8]"
                      : "aspect-[16/10]"
                  }`}
                >
                  <div className="absolute h-32 w-32 rounded-full bg-[#126BFF]/20 blur-3xl" />

                  <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl text-[#126BFF]">
                    ✦
                  </div>
                </div>
              )}

              <div className="p-7 sm:p-8">
                <div className="flex flex-wrap items-center gap-3">
                  {insight.category && (
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#126BFF]">
                      {insight.category}
                    </p>
                  )}

                  {insight.featured && (
                    <span className="rounded-full border border-[#D9A441]/20 bg-[#D9A441]/5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-[#D9A441]">
                      Featured
                    </span>
                  )}
                </div>

                <h3 className="mt-4 text-2xl font-semibold">
                  {insight.title}
                </h3>

                {insight.excerpt && (
                  <p className="mt-4 text-sm leading-7 text-white/45">
                    {insight.excerpt}
                  </p>
                )}

                <div className="mt-6 flex items-center justify-between gap-4">
                  {formatDate(insight.publishedAt) && (
                    <p className="text-xs text-white/30">
                      {formatDate(insight.publishedAt)}
                    </p>
                  )}

                  <a
                    href={`/insights/${insight.slug}`}
                    className="text-sm font-medium text-[#126BFF] transition hover:text-white"
                  >
                    Read Article  
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}