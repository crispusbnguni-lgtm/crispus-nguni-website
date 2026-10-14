
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PortfolioDesign } from "@/components/portfolio/PortfolioDesign";

type ConsultationPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function ConsultationPage({
  params,
}: ConsultationPageProps) {
  const { slug } = await params;

  const portfolio = await prisma.portfolioSite.findUnique({
    where: {
      slug,
    },
    include: {
      consultationTypes: {
        where: {
          active: true,
        },
        orderBy: [
          { featured: "desc" },
          { sortOrder: "asc" },
          { createdAt: "asc" },
        ],
      },
    },
  });

  if (!portfolio || !portfolio.published) {
    notFound();
  }

  return (
    <PortfolioDesign
      theme={portfolio.theme}
      websiteBackground={portfolio.websiteBackground}
    >
      <section className="mx-auto max-w-6xl px-6 py-16 sm:px-8 sm:py-24">
        <div className="max-w-3xl">
          <p className="portfolio-accent text-sm font-medium uppercase tracking-[0.3em]">
            Consultation
          </p>

          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">
            Book a Consultation
          </h1>

          <p className="portfolio-muted mt-6 text-lg leading-8">
            Choose a consultation that fits what you need, then select a
            convenient time to connect.
          </p>
        </div>

        {portfolio.consultationTypes.length === 0 ? (
          <div className="portfolio-glass mt-12 p-8">
            <h2 className="text-xl font-semibold">
              Consultations are currently unavailable
            </h2>

            <p className="portfolio-muted mt-3 max-w-2xl leading-7">
              There are no consultation types available for booking at the
              moment. Please check back later or use the contact options on
              this portfolio.
            </p>
          </div>
        ) : (
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {portfolio.consultationTypes.map((consultationType) => (
              <article
                key={consultationType.id}
                className="portfolio-glass p-7 transition hover:-translate-y-1"
              >
                {consultationType.featured && (
                  <p className="portfolio-accent text-xs font-semibold uppercase tracking-[0.25em]">
                    Featured
                  </p>
                )}

                <h2 className="mt-2 text-2xl font-semibold">
                  {consultationType.title}
                </h2>

                {consultationType.description && (
                  <p className="portfolio-muted mt-4 leading-7">
                    {consultationType.description}
                  </p>
                )}

                <div className="portfolio-muted mt-6 flex flex-wrap gap-3 text-sm">
                  <span className="portfolio-glass px-4 py-2">
                    {consultationType.durationMinutes} minutes
                  </span>

                  {consultationType.meetingMethod && (
                    <span className="portfolio-glass px-4 py-2">
                      {consultationType.meetingMethod}
                    </span>
                  )}
                </div>

                <a
                  href={`/p/${portfolio.slug}/consultation/book?type=${encodeURIComponent(
                    consultationType.id,
                  )}`}
                  className="portfolio-primary-button mt-8"
                >
                  Select Consultation
                </a>
              </article>
            ))}
          </div>
        )}
      </section>
    </PortfolioDesign>
  );
}