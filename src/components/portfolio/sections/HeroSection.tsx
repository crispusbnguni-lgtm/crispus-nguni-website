import Image from "next/image";

type HeroSectionProps = {
  name: string;
  title: string;
  bio: string | null;
  profileImage: string | null;
  location: string | null;
};

export function HeroSection({
  name,
  title,
  bio,
  profileImage,
  location,
}: HeroSectionProps) {
  const imageSource = profileImage || "/ ngunijpg";

  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-32 sm:pb-32 sm:pt-40">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[#126BFF]/10 blur-[140px]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-[#D9A441]">
            Professional Portfolio
          </p>

          <h1 className="mt-6 text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
            {name}
            <span className="text-[#126BFF]">.</span>
          </h1>

          <p className="mt-5 max-w-2xl text-2xl font-medium text-white/70 sm:text-3xl">
            {title}
          </p>

          {bio && (
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/50">
              {bio}
            </p>
          )}

          {location && (
            <p className="mt-5 text-sm text-white/35">
              Based in {location}
            </p>
          )}

          <div className="mt-9 flex flex-wrap gap-4">
            <a
              href="#contact"
              className="rounded-full bg-[#126BFF] px-6 py-3.5 text-sm font-medium text-white transition hover:bg-[#2477ff] hover:shadow-[0_0_30px_rgba(18,107,255,0.3)]"
            >
              Get In Touch
            </a>

            <a
              href="#about"
              className="rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Explore Profile
            </a>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-6 rounded-[44px] bg-gradient-to-br from-[#126BFF]/25 via-[#722BFF]/10 to-[#D9A441]/15 blur-3xl" />

          <div className="relative aspect-[4/5] overflow-hidden rounded-[36px] border border-white/10 bg-[#071A46] shadow-2xl">
            <Image
              src={imageSource}
              alt={name}
              fill
              priority
              className="object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#05070D]/80 via-transparent to-transparent" />

            <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-xl">
              <p className="text-sm font-medium">
                {name}
              </p>

              <p className="mt-1 text-xs text-white/50">
                {title}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}