import Link from "next/link";

const solutions = [
  {
    title: "Wealth Creation",
    description:
      "Build a structured approach to growing, managing and protecting your wealth over time.",
    accent: "#126BFF",
  },
  {
    title: "Investment Planning",
    description:
      "Discuss your investment goals, time horizon, risk considerations and available financial options.",
    accent: "#00C98B",
  },
  {
    title: "Insurance & Protection",
    description:
      "Protect your income, family, health and financial progress against significant risks.",
    accent: "#D9A441",
  },
  {
    title: "Retirement Planning",
    description:
      "Prepare for the future by developing a long-term strategy around income, savings and financial independence.",
    accent: "#722BFF",
  },
  {
    title: "Family Financial Planning",
    description:
      "Create a financial framework that considers your family's current needs and long-term goals.",
    accent: "#126BFF",
  },
  {
    title: "Business Financial Planning",
    description:
      "Consider financial protection, continuity and planning around your business and income.",
    accent: "#00C98B",
  },
  {
    title: "Medical & Health Protection",
    description:
      "Explore how health protection can fit into a broader personal and family financial strategy.",
    accent: "#D9A441",
  },
  {
    title: "Estate & Legacy Planning",
    description:
      "Think beyond today's finances and prepare how your wealth and responsibilities can be handled in the future.",
    accent: "#722BFF",
  },
  {
    title: "Financial Review",
    description:
      "Take a structured look at your current financial position, priorities and areas that may need attention.",
    accent: "#126BFF",
  },
];

export default function SolutionsPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-white">
      <section className="relative overflow-hidden px-6 pb-28 pt-40">
        <div className="pointer-events-none absolute left-1/2 top-10 h-[650px] w-[650px] -translate-x-1/2 rounded-full bg-[#126BFF]/10 blur-[170px]" />

        <div className="relative mx-auto max-w-7xl">
          <Link
            href="/"
            className="text-sm text-white/40 transition hover:text-white"
          >
              Back Home
          </Link>

          <div className="mt-14 max-w-4xl">
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-[#D9A441]">
              Financial Solutions
            </p>

            <h1 className="mt-5 text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
              Your money deserves
              <span className="block text-white/35">
                a thoughtful strategy.
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/50">
              Financial decisions are connected. We look at the bigger picture
              so you can make informed decisions around wealth, protection,
              family and your future.
            </p>

            <Link
              href="/consultation"
              className="mt-9 inline-flex rounded-full bg-[#126BFF] px-7 py-3.5 font-medium transition hover:bg-[#2477ff] hover:shadow-[0_0_35px_rgba(18,107,255,0.3)]"
            >
              Start a Conversation
              <span className="ml-2"> </span>
            </Link>
          </div>

          <div className="mt-20 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {solutions.map((solution, index) => (
              <article
                key={solution.title}
                className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035] p-7 backdrop-blur-xl transition duration-500 hover:-translate-y-2 hover:border-white/20 hover:bg-white/[0.055]"
              >
                <div
                  className="absolute -right-10 -top-10 h-32 w-32 rounded-full blur-[70px] transition duration-500 group-hover:scale-125"
                  style={{
                    backgroundColor: `${solution.accent}18`,
                  }}
                />

                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: solution.accent,
                      }}
                    />

                    <span className="text-sm text-white/20">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <h2 className="mt-9 text-2xl font-semibold">
                    {solution.title}
                  </h2>

                  <p className="mt-4 leading-7 text-white/45">
                    {solution.description}
                  </p>

                  <Link
                    href="/consultation"
                    className="mt-8 inline-flex text-sm font-medium text-white/45 transition group-hover:text-white"
                  >
                    Discuss This  
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-20 overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.035] p-8 sm:p-12">
            <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="max-w-3xl">
                <p className="text-sm font-medium uppercase tracking-[0.3em] text-[#00C98B]">
                  The Approach
                </p>

                <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
                  Good financial planning starts with understanding your
                  situation.
                </h2>

                <p className="mt-5 leading-8 text-white/45">
                  There is no single financial solution that is right for
                  everyone. A conversation helps establish your goals,
                  priorities and circumstances before discussing appropriate
                  options.
                </p>
              </div>

              <Link
                href="/consultation"
                className="inline-flex shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 py-3.5 font-medium transition hover:border-white/25 hover:bg-white/10"
              >
                Book a Consultation
                <span className="ml-2"> </span>
              </Link>
            </div>
          </div>

          <p className="mx-auto mt-10 max-w-3xl text-center text-xs leading-6 text-white/25">
            Financial information and discussions on this website are intended
            for general educational and planning purposes. Specific financial
            solutions are considered based on individual circumstances and
            appropriate professional processes.
          </p>
        </div>
      </section>
    </main>
  );
}