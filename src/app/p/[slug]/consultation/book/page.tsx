
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ConsultationBooking } from "@/components/portfolio/ConsultationBooking";
import { PortfolioDesign } from "@/components/portfolio/PortfolioDesign";

type BookingPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    type?: string;
  }>;
};

export default async function BookingPage({
  params,
  searchParams,
}: BookingPageProps) {
  const { slug } = await params;
  const { type } = await searchParams;

  if (!type) {
    notFound();
  }

  const portfolio = await prisma.portfolioSite.findUnique({
    where: {
      slug,
    },
    select: {
      id: true,
      slug: true,
      published: true,
      name: true,
      theme: true,
      websiteBackground: true,
      consultationTypes: {
        where: {
          id: type,
          active: true,
        },
        take: 1,
      },
    },
  });

  if (!portfolio || !portfolio.published) {
    notFound();
  }

  const consultationType = portfolio.consultationTypes[0];

  if (!consultationType) {
    notFound();
  }

  return (
    <PortfolioDesign
      theme={portfolio.theme}
      websiteBackground={portfolio.websiteBackground}
    >
      <section className="mx-auto max-w-5xl px-6 py-12 sm:px-8 sm:py-20">
        <div className="mb-10">
          <Link
            href={`/p/${portfolio.slug}/consultation`}
            className="portfolio-muted inline-flex items-center gap-2 text-sm transition hover:opacity-75"
          >
            <span aria-hidden="true">←</span>
            Back to consultations
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <aside className="portfolio-glass p-7">
            <p className="portfolio-accent text-xs font-semibold uppercase tracking-[0.25em]">
              Selected Consultation
            </p>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              {consultationType.title}
            </h1>

            {consultationType.description && (
              <p className="portfolio-muted mt-4 leading-7">
                {consultationType.description}
              </p>
            )}

            <div className="mt-7 space-y-3">
              <div className="portfolio-glass p-4">
                <p className="portfolio-muted text-xs uppercase tracking-[0.2em]">
                  Duration
                </p>

                <p className="mt-1 font-medium">
                  {consultationType.durationMinutes} minutes
                </p>
              </div>

              {consultationType.meetingMethod && (
                <div className="portfolio-glass p-4">
                  <p className="portfolio-muted text-xs uppercase tracking-[0.2em]">
                    Meeting
                  </p>

                  <p className="mt-1 font-medium">
                    {consultationType.meetingMethod}
                  </p>
                </div>
              )}
            </div>
          </aside>

          <div className="portfolio-glass p-7 sm:p-9">
            <ConsultationBooking
              slug={portfolio.slug}
              portfolioId={portfolio.id}
              consultationTypeId={consultationType.id}
              consultationTitle={consultationType.title}
              durationMinutes={consultationType.durationMinutes}
              meetingMethod={consultationType.meetingMethod}
            />
          </div>
        </div>
      </section>
    </PortfolioDesign>
  );
}