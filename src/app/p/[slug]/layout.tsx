import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { isValidPortfolioSlug } from "@/lib/portfolio-public";

type PortfolioLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PortfolioLayoutProps): Promise<Metadata> {
  const { slug } = await params;

  if (!isValidPortfolioSlug(slug)) {
    return { robots: { index: false, follow: false } };
  }

  const portfolio = await prisma.portfolioSite.findUnique({
    where: { slug },
    select: {
      published: true,
      visibility: true,
    },
  });

  const isIndexable = Boolean(
    portfolio?.published &&
      portfolio.visibility === "PUBLIC"
  );

  return {
    robots: {
      index: isIndexable,
      follow: isIndexable,
      googleBot: {
        index: isIndexable,
        follow: isIndexable,
      },
    },
  };
}

export default function PortfolioSlugLayout({
  children,
}: PortfolioLayoutProps) {
  return <>{children}</>;
}
