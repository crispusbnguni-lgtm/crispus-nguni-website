
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProfessionalTemplate } from "@/components/portfolio/templates/ProfessionalTemplate";

type PortfolioPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function PublicPortfolioPage({
  params,
}: PortfolioPageProps) {
  const { slug } = await params;

  const portfolio = await prisma.portfolioSite.findUnique({
    where: { slug },
    include: {
      services: { orderBy: { sortOrder: "asc" } },
      experiences: { orderBy: { sortOrder: "asc" } },
      education: {
        orderBy: [
          { sortOrder: "asc" },
          { startDate: "desc" },
        ],
      },
      skills: { orderBy: { sortOrder: "asc" } },
      projects: { orderBy: { sortOrder: "asc" } },
      testimonials: { orderBy: { sortOrder: "asc" } },
      insights: {
        where: { published: true },
        orderBy: [
          { featured: "desc" },
          { sortOrder: "asc" },
          { publishedAt: "desc" },
        ],
      },
    },
  });

  if (!portfolio || !portfolio.published) {
    notFound();
  }

  const websiteBackground =
    portfolio.websiteBackground || "#05070D";

  const isImage = websiteBackground.startsWith("https://");

  return (
    <main
      className="min-h-screen overflow-hidden text-white bg-cover bg-center bg-fixed"
      style={{
        backgroundColor: isImage ? "#05070D" : websiteBackground,
        ...(isImage
          ? {
              backgroundImage: `url("${websiteBackground}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundAttachment: "fixed",
            }
          : {}),
      }}
    >
      <ProfessionalTemplate portfolio={portfolio} />
    </main>
  );
}