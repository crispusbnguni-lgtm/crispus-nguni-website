import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "../../../../../lib/authorization";
import { prisma } from "../../../../../lib/prisma";
import { ProfessionalTemplate } from "../../../../../components/portfolio/templates/ProfessionalTemplate";

type PreviewPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminPortfolioPreview({
  params,
}: PreviewPageProps) {
  await requireSuperAdmin();

  const { id } = await params;

  const portfolio = await prisma.portfolioSite.findUnique({
    where: {
      userId: id,
    },
    include: {
      services: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      experiences: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      education: {
        orderBy: [
          {
            sortOrder: "asc",
          },
          {
            startDate: "desc",
          },
        ],
      },
      skills: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      projects: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      testimonials: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      insights: {
        orderBy: [
          {
            featured: "desc",
          },
          {
            sortOrder: "asc",
          },
          {
            publishedAt: "desc",
          },
        ],
      },
    },
  });

  if (!portfolio) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-white">
      <div className="sticky top-0 z-50 border-b border-white/10 bg-[var(--bg)]/90 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#D9A441]">
              Super Admin Preview
            </p>

            <p className="mt-1 text-xs text-white/40">
              {portfolio.name} ·{" "}
              {portfolio.published ? "Published" : "Draft"}
            </p>
          </div>

          <Link
            href={`/admin/users/${id}`}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
              Back to User
          </Link>
        </div>
      </div>

      <ProfessionalTemplate portfolio={portfolio} />
    </main>
  );
}