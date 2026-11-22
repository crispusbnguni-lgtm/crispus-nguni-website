import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";

/** Preserve old article links while moving their canonical URL under the owner portfolio. */
export default async function LegacyPortfolioInsight({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const insight = await prisma.insight.findFirst({
    where: { slug, published: true, portfolio: { published: true } },
    select: { slug: true, portfolio: { select: { slug: true } } },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
  });
  if (!insight) notFound();
  redirect(`/p/${encodeURIComponent(insight.portfolio.slug)}/insights/${encodeURIComponent(insight.slug)}`);
}
