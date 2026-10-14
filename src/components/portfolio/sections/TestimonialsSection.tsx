type Testimonial = {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  message: string;
  image: string | null;
  rating: number | null;
  featured: boolean;
};

type TestimonialsSectionProps = {
  testimonials: Testimonial[];
};

function Stars({ rating }: { rating: number | null }) {
  if (!rating) {
    return null;
  }

  return (
    <div className="flex gap-1 text-[#D9A441]" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index}>
          {index < rating ? "★" : "☆"}
        </span>
      ))}
    </div>
  );
}

export function TestimonialsSection({
  testimonials,
}: TestimonialsSectionProps) {
  if (testimonials.length === 0) {
    return null;
  }

  const featuredTestimonials = testimonials.filter(
    (testimonial) => testimonial.featured
  );

  const regularTestimonials = testimonials.filter(
    (testimonial) => !testimonial.featured
  );

  const orderedTestimonials = [
    ...featuredTestimonials,
    ...regularTestimonials,
  ];

  return (
    <section
      id="testimonials"
      className="relative overflow-hidden border-t border-white/5 px-6 py-24 sm:py-32"
    >
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#722BFF]/10 blur-[140px]" />

      <div className="relative mx-auto max-w-7xl">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-[#D9A441]">
          Testimonials
        </p>

        <div className="mt-5 max-w-3xl">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            What People Say
          </h2>

          <p className="mt-6 text-lg leading-8 text-white/50">
            Feedback, experiences and perspectives from people who have
            worked with this professional.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {orderedTestimonials.map((testimonial) => (
            <article
              key={testimonial.id}
              className={`group relative rounded-3xl border border-white/10 bg-white/[0.035] p-7 backdrop-blur-xl transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05] ${
                testimonial.featured
                  ? "md:col-span-2 lg:col-span-2"
                  : ""
              }`}
            >
              <div className="absolute right-6 top-6 text-5xl font-serif leading-none text-white/5">
                “
              </div>

              <div className="relative">
                {testimonial.rating && (
                  <Stars rating={testimonial.rating} />
                )}

                <blockquote className="mt-6 text-base leading-8 text-white/60">
                  “{testimonial.message}”
                </blockquote>

                <div className="mt-8 flex items-center gap-4">
                  {testimonial.image ? (
                    <img
                      src={testimonial.image}
                      alt={testimonial.name}
                      className="h-12 w-12 rounded-full border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#126BFF]/10 text-sm font-semibold text-[#126BFF]">
                      {testimonial.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-semibold">
                      {testimonial.name}
                    </p>

                    {(testimonial.role || testimonial.company) && (
                      <p className="mt-1 text-xs text-white/40">
                        {testimonial.role}
                        {testimonial.role && testimonial.company
                          ? " · "
                          : ""}
                        {testimonial.company}
                      </p>
                    )}
                  </div>
                </div>

                {testimonial.featured && (
                  <div className="mt-6">
                    <span className="rounded-full border border-[#D9A441]/20 bg-[#D9A441]/5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-[#D9A441]">
                      Featured Testimonial
                    </span>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}