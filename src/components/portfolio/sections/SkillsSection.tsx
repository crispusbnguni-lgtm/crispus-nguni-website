type Skill = {
  id: string;
  name: string;
  category: string | null;
  level: string | null;
  description: string | null;
};

type SkillsSectionProps = {
  skills: Skill[];
};

const levelWidth: Record<string, string> = {
  Beginner: "w-1/4",
  Intermediate: "w-2/4",
  Advanced: "w-3/4",
  Expert: "w-full",
};

export function SkillsSection({
  skills,
}: SkillsSectionProps) {
  if (skills.length === 0) {
    return null;
  }

  return (
    <section
      id="skills"
      className="relative overflow-hidden border-t border-white/5 px-6 py-24 sm:py-32"
    >
      <div className="pointer-events-none absolute left-0 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-[#722BFF]/10 blur-[140px]" />

      <div className="relative mx-auto max-w-7xl">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-[#D9A441]">
          Skills
        </p>

        <div className="mt-5 max-w-3xl">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Skills & Expertise
          </h2>

          <p className="mt-6 text-lg leading-8 text-white/50">
            The professional capabilities and areas of expertise behind
            the work.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <article
              key={skill.id}
              className="group rounded-3xl border border-white/10 bg-white/[0.035] p-7 backdrop-blur-xl transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#722BFF]/10 text-lg text-[#9a70ff]">
                  ✦
                </div>

                {skill.level && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/45">
                    {skill.level}
                  </span>
                )}
              </div>

              <h3 className="mt-7 text-xl font-semibold">
                {skill.name}
              </h3>

              {skill.category && (
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#D9A441]">
                  {skill.category}
                </p>
              )}

              {skill.description && (
                <p className="mt-4 text-sm leading-7 text-white/45">
                  {skill.description}
                </p>
              )}

              {skill.level && (
                <div className="mt-6">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r from-[#126BFF] to-[#722BFF] ${
                        levelWidth[skill.level] || "w-1/2"
                      }`}
                    />
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}