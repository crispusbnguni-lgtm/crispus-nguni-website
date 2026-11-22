
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  resolvePublicSiteBaseUrl,
  safePortfolioImageUrl,
} from "@/lib/portfolio-public";

type Props = {
  params: Promise<{ slug: string; insightSlug: string }>;
};

export const dynamic = "force-dynamic";

async function findPublicInsight(params: Props["params"]) {
  const { slug, insightSlug } = await params;

  return prisma.insight.findFirst({
    where: {
      slug: insightSlug,
      published: true,
      portfolio: { slug, published: true },
    },
    include: {
      portfolio: {
        select: { name: true, title: true, slug: true },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const insight = await findPublicInsight(params);

  if (!insight) {
    return {
      title: "Insight | Crispus",
      robots: { index: false, follow: false },
    };
  }

  const description =
    insight.excerpt?.slice(0, 300) ||
    `An insight by ${insight.portfolio.name}.`;

  const url = `${resolvePublicSiteBaseUrl()}/p/${insight.portfolio.slug}/insights/${insight.slug}`;
  const image = safePortfolioImageUrl(insight.coverImage);

  return {
    title: `${insight.title} | ${insight.portfolio.name}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: insight.title,
      description,
      url,
      images: image ? [image] : [],
    },
    robots: { index: true, follow: true },
  };
}

export default async function PortfolioInsightPage({
  params,
}: Props) {
  const insight = await findPublicInsight(params);

  if (!insight) notFound();

  const image = safePortfolioImageUrl(insight.coverImage);

  const formattedDate = insight.publishedAt?.toLocaleDateString("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="min-h-screen bg-[var(--bg)] px-5 pb-24 pt-12 text-white sm:px-8 sm:pt-16">
      <article className="mx-auto max-w-4xl">
        <Link
          href={`/p/${encodeURIComponent(insight.portfolio.slug)}#insights`}
          className="text-sm text-white/65 underline underline-offset-4 hover:text-white"
        >
          Back to {insight.portfolio.name}
        </Link>

        {insight.category && (
          <p className="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-[#D9A441]">
            {insight.category}
          </p>
        )}

        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">
          {insight.title}
        </h1>

        {insight.excerpt && (
          <p className="mt-6 text-xl leading-8 text-white/70">
            {insight.excerpt}
          </p>
        )}

        <p className="mt-5 text-sm text-white/55">
          {insight.portfolio.name}
          {formattedDate ? ` · ${formattedDate}` : ""}
        </p>

        {image && (
          <Image
            src={image}
            alt={insight.title}
            width={1600}
            height={900}
            sizes="(max-width: 768px) 100vw, 896px"
            className="mt-10 max-h-[600px] w-full rounded-3xl border border-white/10 object-cover"
          />
        )}

        <div className="mt-10 whitespace-pre-wrap rounded-3xl border border-white/10 bg-white/[0.035] p-6 leading-8 text-white/80 sm:p-10">
          {insight.content}
        </div>

        <Link
          href={`/p/${encodeURIComponent(insight.portfolio.slug)}`}
          className="mt-8 inline-flex min-h-11 items-center text-sm font-semibold text-blue-300 underline underline-offset-4"
        >
          View full portfolio
        </Link>
      </article>
    </main>
  );
}
