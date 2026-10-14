import { HeroSection } from "../sections/HeroSection";
import { AboutSection } from "../sections/AboutSection";
import { ServicesSection } from "../sections/ServicesSection";
import { ExperienceSection } from "../sections/ExperienceSection";
import { EducationSection } from "../sections/EducationSection";
import { SkillsSection } from "../sections/SkillsSection";
import { ProjectsSection } from "../sections/ProjectsSection";
import { TestimonialsSection } from "../sections/TestimonialsSection";
import { InsightsSection } from "../sections/InsightsSection";

type ProfessionalTemplateProps = {
  portfolio: PortfolioData;
};

type PortfolioData = {
  slug: string;
  name: string;
  title: string;
  bio: string | null;
  profileImage: string | null;
  location: string | null;
  phone: string | null;
  website: string | null;
  linkedin: string | null;
  instagram: string | null;
  facebook: string | null;
  youtube: string | null;
  tiktok: string | null;
  whatsapp: string | null;

  services: {
    id: string;
    title: string;
    description: string | null;
    icon: string | null;
    price: string | null;
    link: string | null;
  }[];

  experiences: {
    id: string;
    jobTitle: string;
    company: string;
    employmentType: string | null;
    location: string | null;
    startDate: Date;
    endDate: Date | null;
    current: boolean;
    description: string | null;
    sortOrder: number;
  }[];

  education: {
    id: string;
    institution: string;
    degree: string;
    field: string | null;
    location: string | null;
    startDate: Date;
    endDate: Date | null;
    current: boolean;
    description: string | null;
    sortOrder: number;
  }[];

  skills: {
    id: string;
    name: string;
    category: string | null;
    level: string | null;
    description: string | null;
    sortOrder: number;
  }[];

  projects: {
    id: string;
    title: string;
    description: string | null;
    image: string | null;
    link: string | null;
    category: string | null;
    technologies: string | null;
    featured: boolean;
    sortOrder: number;
  }[];

  testimonials: {
    id: string;
    name: string;
    role: string | null;
    company: string | null;
    message: string;
    image: string | null;
    rating: number | null;
    featured: boolean;
    sortOrder: number;
  }[];

  insights: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: string;
    coverImage: string | null;
    category: string | null;
    published: boolean;
    featured: boolean;
    publishedAt: Date | null;
    sortOrder: number;
  }[];

  showHero: boolean;
  showAbout: boolean;
  showServices: boolean;
  showExperience: boolean;
  showEducation: boolean;
  showSkills: boolean;
  showProjects: boolean;
  showTestimonials: boolean;
  showInsights: boolean;
  showContact: boolean;
};

export function ProfessionalTemplate({
  portfolio,
}: ProfessionalTemplateProps) {
  return (
    <>
      {portfolio.showHero && (
        <HeroSection
          name={portfolio.name}
          title={portfolio.title}
          bio={portfolio.bio}
          profileImage={portfolio.profileImage}
          location={portfolio.location}
        />
      )}

      {portfolio.showAbout && (
        <AboutSection
          name={portfolio.name}
          bio={portfolio.bio}
          location={portfolio.location}
        />
      )}

      {portfolio.showServices && (
        <ServicesSection services={portfolio.services} />
      )}

      {portfolio.showExperience && (
        <ExperienceSection experiences={portfolio.experiences} />
      )}

      {portfolio.showEducation && (
        <EducationSection education={portfolio.education} />
      )}

      {portfolio.showSkills && (
        <SkillsSection skills={portfolio.skills} />
      )}

      {portfolio.showProjects && (
        <ProjectsSection projects={portfolio.projects} />
      )}

      {portfolio.showTestimonials && (
        <TestimonialsSection
          testimonials={portfolio.testimonials}
        />
      )}

      {portfolio.showInsights && (
        <InsightsSection insights={portfolio.insights} />
      )}

      {portfolio.showContact && (
        <section
          id="contact"
          className="border-t border-white/5 px-6 py-24 sm:py-32"
        >
          <div className="mx-auto max-w-7xl">
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-[#D9A441]">
              Contact
            </p>

            <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              Let&apos;s Connect
            </h2>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/50">
              Get in touch to discuss professional opportunities,
              collaborations, services or enquiries.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href={`/p/${portfolio.slug}/consultation`}
                className="rounded-full bg-[#D9A441] px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-[#e8b957] hover:shadow-[0_0_30px_rgba(217,164,65,0.25)]"
              >
                Book a Consultation
              </a>

              {portfolio.phone && (
                <a
                  href={`tel:${portfolio.phone}`}
                  className="rounded-full bg-[#126BFF] px-6 py-3.5 text-sm font-medium transition hover:bg-[#2477ff] hover:shadow-[0_0_30px_rgba(18,107,255,0.3)]"
                >
                  Call
                </a>
              )}

              {portfolio.whatsapp && (
                <a
                  href={portfolio.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-medium transition hover:bg-white/10"
                >
                  WhatsApp
                </a>
              )}

              {portfolio.website && (
                <a
                  href={portfolio.website}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-medium transition hover:bg-white/10"
                >
                  Website
                </a>
              )}

              {portfolio.linkedin && (
                <a
                  href={portfolio.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-medium transition hover:bg-white/10"
                >
                  LinkedIn
                </a>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}