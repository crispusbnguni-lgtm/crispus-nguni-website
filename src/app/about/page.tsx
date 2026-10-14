import Image from "next/image";
import Link from "next/link";

const principles = [
  {
    number: "01",
    title: "People First",
    description:
      "Financial planning should begin with understanding the person, not simply presenting a product.",
    accent: "#126BFF",
  },
  {
    number: "02",
    title: "Clarity Over Complexity",
    description:
      "Good financial conversations should make important decisions easier to understand.",
    accent: "#00C98B",
  },
  {
    number: "03",
    title: "Long-Term Thinking",
    description:
      "Building financial strength is a process that requires discipline, planning and consistency.",
    accent: "#D9A441",
  },
  {
    number: "04",
    title: "Professional Guidance",
    description:
      "Financial decisions deserve careful consideration, appropriate information and professional processes.",
    accent: "#722BFF",
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-white">
      <section className="relative overflow-hidden px-6 pb-28 pt-40">
        <div className="pointer-events-none absolute right-0 top-20 h-[600px] w-[600px] rounded-full bg-[#126BFF]/10 blur-[170px]" />

        <div className="relative mx-auto max-w-7xl">
          <Link
            href="/"
            className="text-sm text-white/40 transition hover:text-white"
          >
              Back Home
          </Link>

          <div className="mt-14 grid items-center gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div className="relative mx-auto w-full max-w-md">
              <div className="absolute -inset-5 rounded-[38px] bg-[#126BFF]/10 blur-3xl" />

              <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.035] p-3 shadow-2xl">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[25px] bg-[#0A0D15]">
                  <Image
                    src="/ ngunijpg"
                    alt="Crispus Nguni"
                    fill
                    priority
                    className="object-cover"
                    sizes="(max-width: 1024px) 90vw, 420px"
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-[#D9A441]">
                About Crispus
              </p>

              <h1 className="mt-5 text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
                Financial decisions
                <span className="block text-white/35">
                  deserve perspective.
                </span>
              </h1>

              <p className="mt-7 max-w-2xl text-lg leading-8 text-white/50">
                I am Crispus Nguni, a Professional Financial Advisor and
                financial educator focused on helping people approach money
                with greater clarity, structure and purpose.
              </p>

              <p className="mt-5 max-w-2xl leading-8 text-white/40">
                My work sits at the intersection of financial education,
                wealth creation, financial protection and long-term planning.
                The goal is not simply to talk about money, but to help people
                think more intentionally about the decisions that shape their
                financial future.
              </p>

              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/consultation"
                  className="inline-flex items-center justify-center rounded-full bg-[#126BFF] px-7 py-3.5 font-medium transition hover:bg-[#2477ff] hover:shadow-[0_0_35px_rgba(18,107,255,0.3)]"
                >
                  Start a Conversation
                  <span className="ml-2"> </span>
                </Link>

                <Link
                  href="/solutions"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-7 py-3.5 font-medium transition hover:border-white/20 hover:bg-white/10"
                >
                  Explore Solutions
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-28 grid gap-5 md:grid-cols-3">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-7 backdrop-blur-xl">
              <p className="text-sm uppercase tracking-[0.25em] text-white/25">
                Education
              </p>

              <h2 className="mt-5 text-2xl font-semibold">
                BSc Actuarial Science
              </h2>

              <p className="mt-3 leading-7 text-white/40">
                A quantitative foundation that supports analytical thinking
                around risk, finance and financial decision making.
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-7 backdrop-blur-xl">
              <p className="text-sm uppercase tracking-[0.25em] text-white/25">
                Focus
              </p>

              <h2 className="mt-5 text-2xl font-semibold">
                Financial Planning
              </h2>

              <p className="mt-3 leading-7 text-white/40">
                Wealth creation, protection, investment thinking and
                long-term financial planning.
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-7 backdrop-blur-xl">
              <p className="text-sm uppercase tracking-[0.25em] text-white/25">
                Philosophy
              </p>

              <h2 className="mt-5 text-2xl font-semibold">
                Informed Decisions
              </h2>

              <p className="mt-3 leading-7 text-white/40">
                Helping people understand their options before making
                important financial decisions.
              </p>
            </div>
          </div>

          <div className="mt-20">
            <div className="max-w-3xl">
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-[#00C98B]">
                What I Believe
              </p>

              <h2 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
                Financial planning is personal.
              </h2>

              <p className="mt-5 leading-8 text-white/45">
                Your income, responsibilities, ambitions and circumstances are
                different from someone else&apos;s. That is why meaningful
                financial conversations should begin with understanding your
                situation.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2">
              {principles.map((principle) => (
                <article
                  key={principle.number}
                  className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035] p-7 backdrop-blur-xl transition duration-500 hover:-translate-y-1 hover:border-white/20"
                >
                  <div
                    className="absolute -right-10 -top-10 h-32 w-32 rounded-full blur-[70px] transition duration-500 group-hover:scale-125"
                    style={{
                      backgroundColor: `${principle.accent}18`,
                    }}
                  />

                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <span
                        className="text-sm font-medium"
                        style={{
                          color: principle.accent,
                        }}
                      >
                        {principle.number}
                      </span>

                      <span className="h-2 w-2 rounded-full bg-white/20" />
                    </div>

                    <h3 className="mt-8 text-2xl font-semibold">
                      {principle.title}
                    </h3>

                    <p className="mt-4 leading-7 text-white/40">
                      {principle.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-20 rounded-[32px] border border-[#126BFF]/20 bg-[#126BFF]/5 p-8 sm:p-12">
            <div className="max-w-3xl">
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-[#126BFF]">
                The Next Step
              </p>

              <h2 className="mt-5 text-3xl font-semibold sm:text-4xl">
                You do not need to have everything figured out before you
                start.
              </h2>

              <p className="mt-5 leading-8 text-white/45">
                Sometimes the most useful first step is simply having a
                structured conversation about where you are, where you want to
                go and what matters most to you.
              </p>

              <Link
                href="/consultation"
                className="mt-8 inline-flex rounded-full bg-[#126BFF] px-7 py-3.5 font-medium transition hover:bg-[#2477ff] hover:shadow-[0_0_35px_rgba(18,107,255,0.3)]"
              >
                Book a Consultation
                <span className="ml-2"> </span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}