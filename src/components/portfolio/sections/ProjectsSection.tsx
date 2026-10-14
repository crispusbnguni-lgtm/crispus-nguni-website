import Image from "next/image";

type Project = {
  id: string;
  title: string;
  description: string | null;
  image: string | null;
  link: string | null;
  category: string | null;
  technologies: string | null;
  featured: boolean;
};

type ProjectsSectionProps = {
  projects: Project[];
};

export function ProjectsSection({
  projects,
}: ProjectsSectionProps) {
  if (projects.length === 0) {
    return null;
  }

  const featuredProjects = projects.filter(
    (project) => project.featured
  );

  const regularProjects = projects.filter(
    (project) => !project.featured
  );

  const orderedProjects = [
    ...featuredProjects,
    ...regularProjects,
  ];

  return (
    <section
      id="projects"
      className="relative overflow-hidden border-t border-white/5 px-6 py-24 sm:py-32"
    >
      <div className="pointer-events-none absolute right-0 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-[#126BFF]/10 blur-[140px]" />

      <div className="relative mx-auto max-w-7xl">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-[#D9A441]">
          Projects
        </p>

        <div className="mt-5 max-w-3xl">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Selected Work
          </h2>

          <p className="mt-6 text-lg leading-8 text-white/50">
            A selection of projects, professional work and achievements.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {orderedProjects.map((project) => (
            <article
              key={project.id}
              className={`group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-xl transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05] ${
                project.featured
                  ? "md:col-span-2 lg:col-span-2"
                  : ""
              }`}
            >
              {project.image ? (
                <div
                  className={`relative overflow-hidden bg-[#071A46] ${
                    project.featured
                      ? "aspect-[16/8]"
                      : "aspect-[16/10]"
                  }`}
                >
                  <Image
                    src={project.image}
                    alt={project.title}
                    fill
                    sizes={
                      project.featured
                        ? "(max-width: 768px) 100vw, (max-width: 1024px) 100vw, 66vw"
                        : "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    }
                    className="object-cover transition duration-700 group-hover:scale-105"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-[#05070D]/80 via-transparent to-transparent" />

                  {project.featured && (
                    <span className="absolute left-5 top-5 rounded-full border border-[#D9A441]/20 bg-black/50 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-[#D9A441] backdrop-blur-md">
                      Featured
                    </span>
                  )}
                </div>
              ) : (
                <div
                  className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#071A46] via-[#0b1230] to-[#05070D] ${
                    project.featured
                      ? "aspect-[16/8]"
                      : "aspect-[16/10]"
                  }`}
                >
                  <div className="absolute h-32 w-32 rounded-full bg-[#126BFF]/20 blur-3xl" />

                  <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl text-[#126BFF]">
                    ✦
                  </div>

                  {project.featured && (
                    <span className="absolute left-5 top-5 rounded-full border border-[#D9A441]/20 bg-black/50 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-[#D9A441] backdrop-blur-md">
                      Featured
                    </span>
                  )}
                </div>
              )}

              <div className="p-7 sm:p-8">
                <div className="flex flex-wrap items-center gap-3">
                  {project.category && (
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#126BFF]">
                      {project.category}
                    </p>
                  )}

                  {project.featured && !project.image && (
                    <span className="text-[10px] uppercase tracking-[0.15em] text-[#D9A441]">
                      Featured
                    </span>
                  )}
                </div>

                <h3 className="mt-3 text-2xl font-semibold">
                  {project.title}
                </h3>

                {project.description && (
                  <p className="mt-4 text-sm leading-7 text-white/45">
                    {project.description}
                  </p>
                )}

                {project.technologies && (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {project.technologies
                      .split(",")
                      .map((technology) => technology.trim())
                      .filter(Boolean)
                      .map((technology) => (
                        <span
                          key={technology}
                          className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/40"
                        >
                          {technology}
                        </span>
                      ))}
                  </div>
                )}

                {project.link && (
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-7 inline-flex items-center text-sm font-medium text-[#126BFF] transition hover:text-white"
                  >
                    View Project
                    <span className="ml-2 transition group-hover:translate-x-1">
                       
                    </span>
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}