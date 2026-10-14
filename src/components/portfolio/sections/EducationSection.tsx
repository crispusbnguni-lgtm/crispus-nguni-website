type Education = {
  id: string;
  institution: string;
  degree: string;
  field: string | null;
  location: string | null;
  startDate: Date | string;
  endDate: Date | string | null;
  current: boolean;
  description: string | null;
};

type EducationSectionProps = {
  education: Education[];
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

export function EducationSection({
  education,
}: EducationSectionProps) {
  if (education.length === 0) {
    return null;
  }

  return (
    <section
      id="education"
      className="relative overflow-hidden border-t border-white/5 px-6 py-24 sm:py-32"
    >
      <div className="pointer-events-none absolute left-0 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-[#722BFF]/10 blur-[140px]" />

      <div className="relative mx-auto max-w-7xl">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-[#D9A441]">
          Education
        </p>

        <div className="mt-5 max-w-3xl">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Education & Qualifications
          </h2>

          <p className="mt-6 text-lg leading-8 text-white/50">
            Academic qualifications, learning experiences and educational
            milestones.
          </p>
        </div>

        <div className="relative mt-14">
          <div className="absolute bottom-0 left-[19px] top-0 w-px bg-gradient-to-b from-[#722BFF]/60 via-white/10 to-transparent sm:left-[23px]" />

          <div className="space-y-10">
            {education.map((item) => (
              <article
                key={item.id}
                className="relative pl-12 sm:pl-16"
              >
                <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-[#722BFF]/40 bg-[#071A46] shadow-[0_0_25px_rgba(114,43,255,0.2)] sm:left-2.5">
                  <div className="h-2 w-2 rounded-full bg-[#722BFF]" />
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.05] sm:p-8">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#D9A441]">
                        {item.degree}
                      </p>

                      <h3 className="mt-3 text-2xl font-semibold">
                        {item.institution}
                      </h3>

                      {item.field && (
                        <p className="mt-2 text-base font-medium text-[#126BFF]">
                          {item.field}
                        </p>
                      )}
                    </div>

                    <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/50">
                      {formatDate(item.startDate)} —{" "}
                      {item.current
                        ? "Present"
                        : formatDate(item.endDate)}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {item.location && (
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/45">
                        {item.location}
                      </span>
                    )}

                    {item.current && (
                      <span className="rounded-full border border-[#00C98B]/20 bg-[#00C98B]/5 px-3 py-1.5 text-xs text-[#00C98B]">
                        Currently Studying
                      </span>
                    )}
                  </div>

                  {item.description && (
                    <p className="mt-6 max-w-4xl text-base leading-8 text-white/50">
                      {item.description}
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