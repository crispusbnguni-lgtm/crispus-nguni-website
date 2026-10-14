import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "../../../../lib/authorization";
import { prisma } from "../../../../lib/prisma";

type AdminUserPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminUserPage({
  params,
}: AdminUserPageProps) {
  await requireSuperAdmin();

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: {
      id,
    },
    include: {
      portfolioSite: {
        include: {
          services: true,
          experiences: true,
          education: true,
          skills: true,
          projects: true,
          testimonials: true,
          insights: true,
        },
      },
    },
  });

  if (!user) {
    notFound();
  }

  const portfolio = user.portfolioSite;

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin" className="text-2xl font-semibold">
              Crispus<span className="text-[#126BFF]">.</span>
            </Link>

            <p className="mt-2 text-sm text-white/40">
              Super Admin Console
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
              Back to Admin
          </Link>
        </header>

        <section className="py-12">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-[#D9A441]">
            Portfolio Account
          </p>

          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            {user.name || "Unnamed User"}
          </h1>

          <p className="mt-3 text-white/40">
            {user.email}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60">
              Role: {user.role}
            </span>

            <span
              className={`rounded-full border px-4 py-2 text-sm ${
                portfolio?.published
                  ? "border-[#00C98B]/20 bg-[#00C98B]/10 text-[#00C98B]"
                  : "border-[#D9A441]/20 bg-[#D9A441]/10 text-[#D9A441]"
              }`}
            >
              {portfolio?.published ? "Published" : "Draft"}
            </span>
          </div>

          {!portfolio ? (
            <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.035] p-8">
              <h2 className="text-xl font-semibold">
                No portfolio found
              </h2>

              <p className="mt-3 text-white/40">
                This account does not currently have a portfolio site.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-10 grid gap-5 md:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                  <p className="text-sm text-white/40">
                    Services
                  </p>

                  <p className="mt-3 text-3xl font-semibold">
                    {portfolio.services.length}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                  <p className="text-sm text-white/40">
                    Projects
                  </p>

                  <p className="mt-3 text-3xl font-semibold">
                    {portfolio.projects.length}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                  <p className="text-sm text-white/40">
                    Insights
                  </p>

                  <p className="mt-3 text-3xl font-semibold">
                    {portfolio.insights.length}
                  </p>
                </div>
              </div>

              <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.025] p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">
                      Portfolio Website
                    </h2>

                    <p className="mt-2 text-sm text-white/40">
                      {portfolio.title}
                    </p>

                    <p className="mt-2 text-xs text-white/25">
                      /p/{portfolio.slug}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/p/${portfolio.slug}`}
                      target="_blank"
                      className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                      View Website
                    </Link>

                    <Link
                      href={`/dashboard/portfolio?adminUserId=${user.id}`}
                      className="rounded-xl bg-[#126BFF] px-5 py-3 text-sm font-medium transition hover:bg-[#2477ff]"
                    >
                      Edit Portfolio
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-10 grid gap-5 md:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
                  <h2 className="text-lg font-semibold">
                    Portfolio Information
                  </h2>

                  <div className="mt-5 space-y-4 text-sm">
                    <div>
                      <p className="text-white/30">
                        Name
                      </p>

                      <p className="mt-1 text-white/80">
                        {portfolio.name}
                      </p>
                    </div>

                    <div>
                      <p className="text-white/30">
                        Professional Title
                      </p>

                      <p className="mt-1 text-white/80">
                        {portfolio.title}
                      </p>
                    </div>

                    <div>
                      <p className="text-white/30">
                        Location
                      </p>

                      <p className="mt-1 text-white/80">
                        {portfolio.location || "Not provided"}
                      </p>
                    </div>

                    <div>
                      <p className="text-white/30">
                        Phone
                      </p>

                      <p className="mt-1 text-white/80">
                        {portfolio.phone || "Not provided"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
                  <h2 className="text-lg font-semibold">
                    Portfolio Content
                  </h2>

                  <div className="mt-5 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-2xl font-semibold">
                        {portfolio.experiences.length}
                      </p>

                      <p className="text-sm text-white/35">
                        Experience
                      </p>
                    </div>

                    <div>
                      <p className="text-2xl font-semibold">
                        {portfolio.education.length}
                      </p>

                      <p className="text-sm text-white/35">
                        Education
                      </p>
                    </div>

                    <div>
                      <p className="text-2xl font-semibold">
                        {portfolio.skills.length}
                      </p>

                      <p className="text-sm text-white/35">
                        Skills
                      </p>
                    </div>

                    <div>
                      <p className="text-2xl font-semibold">
                        {portfolio.testimonials.length}
                      </p>

                      <p className="text-sm text-white/35">
                        Testimonials
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}