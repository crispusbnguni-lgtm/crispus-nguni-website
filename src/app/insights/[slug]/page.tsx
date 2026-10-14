import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

type InsightPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function InsightPage({
  params,
}: InsightPageProps) {
  const { slug } = await params;

  const insight = await prisma.insight.findFirst({
    where: {
      slug,
      published: true,
    },
    include: {
      portfolio: {
        select: {
          name: true,
          title: true,
          slug: true,
        },
      },
    },
  });

  if (!insight) {
    notFound();
  }

  const formattedDate = insight.publishedAt
    ? new Date(insight.publishedAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <main className="min-h-screen bg-[var(--bg)] text-white">
      <article className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-[#126BFF]/10 blur-[140px]" />

        <div className="relative mx-auto max-w-4xl px-6 pb-24 pt-32 sm:pb-32 sm:pt-40">
          <a
            href={`/p/${insight.portfolio.slug}#insights`}
            className="inline-flex items-center text-sm text-white/40 transition hover:text-white"
          >
              Back to {insight.portfolio.name}
          </a>

          <div className="mt-10">
            {insight.category && (
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-[#D9A441]">
                {insight.category}
              </p>
            )}

            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">
              {insight.title}
            </h1>

            {insight.excerpt && (
              <p className="mt-7 text-xl leading-9 text-white/50">
                {insight.excerpt}
              </p>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-3 text-sm text-white/30">
              <span>{insight.portfolio.name}</span>

              {formattedDate && (
                <>
                  <span>·</span>
                  <span>{formattedDate}</span>
                </>
              )}
            </div>
          </div>

          {insight.coverImage && (
            <div className="mt-12 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
              <img
                src={insight.coverImage}
                alt={insight.title}
                className="max-h-[600px] w-full object-cover"
              />
            </div>
          )}

          <div className="mt-14 rounded-3xl border border-white/10 bg-white/[0.025] p-7 backdrop-blur-xl sm:p-10">
            <div className="whitespace-pre-wrap text-base leading-8 text-white/65 sm:text-lg sm:leading-9">
              {insight.content}
            </div>
          </div>

          <div className="mt-12 border-t border-white/10 pt-8">
            <p className="text-sm text-white/30">
              {insight.portfolio.title}
            </p>

            <a
              href={`/p/${insight.portfolio.slug}`}
              className="mt-3 inline-flex text-sm font-medium text-[#126BFF] transition hover:text-white"
            >
              View full portfolio  
            </a>
          </div>
        </div>
      </article>
    </main>
  );
}