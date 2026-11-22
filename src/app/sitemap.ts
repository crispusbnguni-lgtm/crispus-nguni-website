import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { resolvePublicSiteBaseUrl } from "@/lib/portfolio-public";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = resolvePublicSiteBaseUrl();

  const [portfolios, insights] = await Promise.all([prisma.portfolioSite.findMany({
    where: {
      published: true,
      visibility: "PUBLIC",
    },
    select: {
      slug: true,
      updatedAt: true,
    },
  }), prisma.insight.findMany({
    where: { published: true, portfolio: { published: true, visibility: "PUBLIC" } },
    select: { slug: true, portfolio: { select: { slug: true } } },
  })]);

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
    },
    ...["about", "how-it-works", "services", "contact", "explore"].map((path) => ({
      url: `${baseUrl}/${path}`,
      lastModified: new Date(),
    })),
    ...portfolios.map((portfolio) => ({
      url: `${baseUrl}/p/${portfolio.slug}`,
      lastModified: portfolio.updatedAt,
    })),
    ...insights.map((insight) => ({
      url: `${baseUrl}/p/${insight.portfolio.slug}/insights/${insight.slug}`,
      lastModified: new Date(),
    })),
  ];
}
