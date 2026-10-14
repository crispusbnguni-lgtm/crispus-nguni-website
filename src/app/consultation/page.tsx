import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ConsultationForm } from "@/components/consultation/ConsultationForm";

type ConsultationPageProps = {
  searchParams: Promise<{
    portfolioSlug?: string;
  }>;
};

const consultationTypes = [
  {
    title: "Financial Education",
    description:
      "A focused conversation to help you understand a financial topic, concept or decision.",
  },
  {
    title: "Wealth Planning",
    description:
      "Discuss your financial goals, wealth-building priorities and long-term planning.",
  },
  {
    title: "Insurance & Protection",
    description:
      "Explore financial protection, insurance planning and how insurance can fit into a wider strategy.",
  },
  {
    title: "Investment Discussion",
    description:
      "Discuss investing concepts, risk, markets and principles to consider before investing.",
  },
  {
    title: "Retirement Planning",
    description:
      "Start thinking about long-term financial independence, retirement goals and preparation.",
  },
  {
    title: "Business & Financial Planning",
    description:
      "Discuss financial considerations around business, income, protection and long-term planning.",
  },
];

export default async function ConsultationPage({
  searchParams,
}: ConsultationPageProps) {
  const { portfolioSlug } = await searchParams;

  if (!portfolioSlug) {
    notFound();
  }

  const portfolio = await prisma.portfolioSite.findUnique({
    where: {
      slug: portfolioSlug,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      title: true,
      profileImage: true,
      phone: true,
      whatsapp: true,
      published: true,
    },
  });

  if (!portfolio || !portfolio.published) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-white">
      <section className="relative overflow-hidden px-6 pb-24 pt-40">
        <div className="pointer-events-none absolute left-1/2 top-1/4 h-[650px] w-[650px] -translate-x-1/2 rounded-full bg-[#126BFF]/10 blur-[160px]" />

        <div className="relative mx-auto max-w-7xl">
          <Link
            href={`/p/${portfolio.slug}`}
            className="text-sm text-white/40 transition hover:text-white"
          >
              Back to {portfolio.name}
          </Link>

          <div className="mt-14 max-w-4xl">
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-[#D9A441]">
              Consultation with {portfolio.name}
            </p>

            <h1 className="mt-5 text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
              Let&apos;s talk about
              <span className="block text-white/35">
                your goals.
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/50">
              Start a focused conversation with{" "}
              <span className="text-white/80">
                {portfolio.name}
              </span>
              {portfolio.title
                ? `, ${portfolio.title.toLowerCase()}`
                : ""}
              .
            </p>
          </div>

          <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {consultationTypes.map((type, index) => (
              <article
                key={type.title}
                className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035] p-7 backdrop-blur-xl transition duration-500 hover:-translate-y-2 hover:border-white/20 hover:bg-white/[0.055]"
              >
                <div className="absolute right-6 top-6 text-sm text-white/20">
                  {String(index + 1).padStart(2, "0")}
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#126BFF]/20 bg-[#126BFF]/10 text-[#126BFF]">
                  ◈
                </div>

                <h2 className="mt-10 text-2xl font-semibold">
                  {type.title}
                </h2>

                <p className="mt-4 leading-7 text-white/45">
                  {type.description}
                </p>

                <div className="mt-8 border-t border-white/10 pt-5">
                  <span className="text-sm font-medium text-white/60 transition group-hover:text-white">
                    Request a Conversation  
                  </span>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-20 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <ConsultationForm
              portfolioSlug={portfolio.slug}
              professionalName={portfolio.name}
            />

            <div className="rounded-[32px] border border-[#126BFF]/20 bg-[#126BFF]/5 p-8 backdrop-blur-xl sm:p-10">
              <p className="text-sm uppercase tracking-[0.3em] text-[#126BFF]">
                Start Here
              </p>

              <h2 className="mt-4 text-3xl font-semibold">
                Have a question?
              </h2>

              <p className="mt-5 leading-7 text-white/45">
                You do not need to have everything figured out before
                starting a conversation. The first step is simply
                understanding what you are trying to achieve.
              </p>

              {portfolio.whatsapp && (
                <a
                  href={portfolio.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 inline-flex rounded-full bg-[#126BFF] px-7 py-3.5 font-medium transition hover:bg-[#2477ff] hover:shadow-[0_0_35px_rgba(18,107,255,0.3)]"
                >
                  Start a Conversation
                  <span className="ml-2"> </span>
                </a>
              )}

              <p className="mt-5 text-xs leading-5 text-white/30">
                Initial conversations are intended for education and general
                discussion. Specific recommendations may require additional
                information and appropriate professional processes.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}