type Service = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  price: string | null;
  link: string | null;
};

type ServicesSectionProps = {
  services: Service[];
};

export function ServicesSection({
  services,
}: ServicesSectionProps) {
  return (
    <section
      id="services"
      className="relative overflow-hidden border-t border-white/5 px-6 py-24 sm:py-32"
    >
      <div className="pointer-events-none absolute left-0 top-1/2 h-[450px] w-[450px] -translate-y-1/2 rounded-full bg-[#126BFF]/10 blur-[130px]" />

      <div className="relative mx-auto max-w-7xl">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-[#D9A441]">
          Services
        </p>

        <div className="mt-5 max-w-3xl">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Professional Services
          </h2>

          <p className="mt-6 text-lg leading-8 text-white/50">
            Explore the professional services and solutions offered.
          </p>
        </div>

        {services.length > 0 ? (
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <article
                key={service.id}
                className="group rounded-3xl border border-white/10 bg-white/[0.035] p-7 backdrop-blur-xl transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#126BFF]/10 text-lg text-[#126BFF]">
                    {service.icon || "✦"}
                  </div>

                  {service.price && (
                    <p className="text-sm font-medium text-[#D9A441]">
                      {service.price}
                    </p>
                  )}
                </div>

                <h3 className="mt-7 text-xl font-semibold">
                  {service.title}
                </h3>

                {service.description && (
                  <p className="mt-3 text-sm leading-7 text-white/45">
                    {service.description}
                  </p>
                )}

                {service.link && (
                  <a
                    href={service.link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-6 inline-flex text-sm font-medium text-[#126BFF] transition hover:text-white"
                  >
                    Learn More
                    <span className="ml-2"> </span>
                  </a>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-12 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
            <p className="text-sm text-white/40">
              No services have been added yet.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}