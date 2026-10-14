type Experience = {
  id: string;
  jobTitle: string;
  company: string;
  employmentType: string | null;
  location: string | null;
  startDate: Date | string;
  endDate: Date | string | null;
  current: boolean;
  description: string | null;
};

type ExperienceSectionProps = {
  experiences: Experience[];
};

function formatDate(date: Date | string | null) {
  if (!date) {
    return "Present";
  }

  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export function ExperienceSection({
  experiences,
}: ExperienceSectionProps) {
  if (experiences.length === 0) {
    return null;
  }

  return (
    <section
      id="experience"
      className="relative overflow-hidden border-t border-white/5 px-6 py-24 sm:py-32"
    >
      <div className="pointer-events-none absolute right-0 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-[#126BFF]/10 blur-[140px]" />

      <div className="relative mx-auto max-w-7xl">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-[#D9A441]">
          Experience
        </p>

        <div className="mt-5 max-w-3xl">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Professional Journey
          </h2>

          <p className="mt-6 text-lg leading-8 text-white/50">
            A look at the professional experience, roles and organisations
            that have shaped the journey.
          </p>
        </div>

        <div className="relative mt-14">
          <div className="absolute bottom-0 left-[19px] top-0 w-px bg-gradient-to-b from-[#126BFF]/60 via-white/10 to-transparent sm:left-[23px]" />

          <div className="space-y-10">
            {experiences.map((experience) => (
              <article
                key={experience.id}
                className="relative pl-12 sm:pl-16"
              >
                <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-[#126BFF]/40 bg-[#071A46] shadow-[0_0_25px_rgba(18,107,255,0.2)] sm:left-2.5">
                  <div className="h-2 w-2 rounded-full bg-[#126BFF]" />
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.05] sm:p-8">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-2xl font-semibold">
                        {experience.jobTitle}
                      </h3>

                      <p className="mt-2 text-base font-medium text-[#126BFF]">
                        {experience.company}
                      </p>
                    </div>

                    <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/50">
                      {formatDate(experience.startDate)}{" "}
                      —{" "}
                      {experience.current
                        ? "Present"
                        : formatDate(experience.endDate)}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {experience.employmentType && (
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/45">
                        {experience.employmentType}
                      </span>
                    )}

                    {experience.location && (
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/45">
                        {experience.location}
                      </span>
                    )}

                    {experience.current && (
                      <span className="rounded-full border border-[#00C98B]/20 bg-[#00C98B]/5 px-3 py-1.5 text-xs text-[#00C98B]">
                        Current Position
                      </span>
                    )}
                  </div>

                  {experience.description && (
                    <p className="mt-6 max-w-4xl text-base leading-8 text-white/50">
                      {experience.description}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}