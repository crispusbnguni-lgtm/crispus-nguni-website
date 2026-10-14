import Link from "next/link";
import { articles } from "@/data/articles";

export default function InsightsPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-white">
      <section className="relative overflow-hidden px-6 pb-24 pt-40">
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[#722BFF]/10 blur-[150px]" />

        <div className="relative mx-auto max-w-7xl">
          <Link
            href="/"
            className="text-sm text-white/40 transition hover:text-white"
          >
              Back Home
          </Link>

          <div className="mt-14 max-w-3xl">
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-[#D9A441]">
              Insights
            </p>

            <h1 className="mt-5 text-5xl font-semibold tracking-tight sm:text-6xl">
              Financial ideas,
              <span className="block text-white/35">
                explained clearly.
              </span>
            </h1>

            <p className="mt-7 text-lg leading-8 text-white/50">
              Practical financial education covering money management,
              investing, markets, protection and long-term wealth creation.
            </p>
          </div>

          <div className="mt-16 grid gap-5 lg:grid-cols-3">
            {articles.map((article) => (
              <article
                key={article.id}
                className="group rounded-[28px] border border-white/10 bg-white/[0.035] p-7 backdrop-blur-xl transition duration-500 hover:-translate-y-2 hover:border-white/20"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-[#D9A441]">
                    {article.category}
                  </span>

                  <span className="text-xs text-white/25">
                    {article.readTime}
                  </span>
                </div>

                <h2 className="mt-10 text-2xl font-semibold leading-tight">
                  {article.title}
                </h2>

                <p className="mt-4 leading-7 text-white/45">
                  {article.excerpt}
                </p>

                <div className="mt-8 border-t border-white/10 pt-5">
                  <Link
                    href={`/insights/${article.slug}`}
                    className="text-sm font-medium text-white/60 transition group-hover:text-white"
                  >
                    Read Article  
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}