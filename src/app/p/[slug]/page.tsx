import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProfessionalTemplate } from "@/components/portfolio/templates/ProfessionalTemplate";
import {
  isValidPortfolioSlug,
  resolvePublicSiteBaseUrl,
  safePortfolioBackground,
  safePortfolioImageUrl,
} from "@/lib/portfolio-public";

type PortfolioPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PortfolioPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidPortfolioSlug(slug)) {
    return { title: "Professional Portfolio | Crispus", robots: { index: false, follow: false } };
  }

  const portfolio = await prisma.portfolioSite.findUnique({
    where: { slug },
    select: {
      name: true,
      title: true,
      bio: true,
      profileImage: true,
      published: true,
      visibility: true,
    },
  });

  if (!portfolio?.published) {
    return { title: "Professional Portfolio | Crispus", robots: { index: false, follow: false } };
  }

  const title = `${portfolio.name} — ${portfolio.title} | Crispus`;
  const description = (portfolio.bio?.trim() || `Explore ${portfolio.name}'s professional portfolio.`).slice(0, 300);
  const baseUrl = resolvePublicSiteBaseUrl();
  const url = `${baseUrl}/p/${slug}`;
  const image = safePortfolioImageUrl(portfolio.profileImage);
  const indexable = portfolio.visibility === "PUBLIC";

  return {
    title,
    description,
    alternates: indexable ? { canonical: url } : undefined,
    openGraph: {
      type: "website",
      title,
      description,
      url: indexable ? url : undefined,
      images: image ? [image] : [],
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : [],
    },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false },
  };
}

export default async function PublicPortfolioPage({ params }: PortfolioPageProps) {
  const { slug } = await params;
  if (!isValidPortfolioSlug(slug)) notFound();

  const portfolio = await prisma.portfolioSite.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      title: true,
      bio: true,
      profileImage: true,
      location: true,
      phone: true,
      website: true,
      linkedin: true,
      instagram: true,
      facebook: true,
      youtube: true,
      tiktok: true,
      whatsapp: true,
      websiteBackground: true,
      published: true,
      visibility: true,
      showHero: true,
      showAbout: true,
      showServices: true,
      showExperience: true,
      showEducation: true,
      showSkills: true,
      showProjects: true,
      showTestimonials: true,
      showInsights: true,
      showContact: true,
      services: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true, description: true, icon: true, price: true, link: true },
      },
      experiences: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, jobTitle: true, company: true, employmentType: true, location: true, startDate: true, endDate: true, current: true, description: true, sortOrder: true },
      },
      education: {
        orderBy: [{ sortOrder: "asc" }, { startDate: "desc" }],
        select: { id: true, institution: true, degree: true, field: true, location: true, startDate: true, endDate: true, current: true, description: true, sortOrder: true },
      },
      skills: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, category: true, level: true, description: true, sortOrder: true },
      },
      projects: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true, description: true, image: true, link: true, category: true, technologies: true, featured: true, sortOrder: true },
      },
      testimonials: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, role: true, company: true, message: true, image: true, rating: true, featured: true, sortOrder: true },
      },
      insights: {
        where: { published: true },
        orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { publishedAt: "desc" }],
        select: { id: true, title: true, slug: true, excerpt: true, coverImage: true, category: true, published: true, featured: true, publishedAt: true, sortOrder: true },
      },
    },
  });

  // Published UNLISTED portfolios remain reachable by their exact link, but are
  // excluded from Explore and receive noindex metadata from this route's layout.
  if (!portfolio?.published) notFound();

  const resolvedBackground = safePortfolioBackground(portfolio.websiteBackground);
  const backgroundImage = resolvedBackground?.kind === "image"
    ? resolvedBackground.value
    : null;
  const isImage = backgroundImage !== null;
  const backgroundColor = resolvedBackground?.kind === "color"
    ? resolvedBackground.value
    : "#05070D";

  return (
    <main
      className="min-h-screen overflow-hidden bg-cover bg-center bg-fixed text-white"
      style={{
        backgroundColor,
        ...(isImage
          ? {
              backgroundImage: `url("${backgroundImage}")`,
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
