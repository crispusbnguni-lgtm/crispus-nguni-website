type AboutSectionProps = {
  name: string;
  bio: string | null;
  location: string | null;
};

export function AboutSection({
  name,
  bio,
  location,
}: AboutSectionProps) {
  return (
    <section
      id="about"
      className="relative overflow-hidden border-t border-white/5 px-6 py-24 sm:py-32"
    >
      <div className="pointer-events-none absolute right-0 top-1/2 h-[450px] w-[450px] -translate-y-1/2 rounded-full bg-[#722BFF]/10 blur-[130px]" />

      <div className="relative mx-auto max-w-7xl">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-[#D9A441]">
          About
        </p>

        <div className="mt-5 grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              About {name}
            </h2>

            {location && (
              <p className="mt-5 text-sm text-white/35">
                Based in {location}
              </p>
            )}
          </div>

          <div>
            <p className="text-lg leading-8 text-white/60">
              {bio ||
                "This professional portfolio provides an introduction to the person, their work and their professional journey."}
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 backdrop-blur-xl">
                <p className="text-xl font-semibold">
                  Professional
                </p>

                <p className="mt-2 text-sm leading-6 text-white/40">
                  Present your professional identity, experience and
                  capabilities with clarity.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 backdrop-blur-xl">
                <p className="text-xl font-semibold">
                  Personal
                </p>

                <p className="mt-2 text-sm leading-6 text-white/40">
                  Share the story, values and perspective behind your work.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}