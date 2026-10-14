-- AlterTable
ALTER TABLE "PortfolioSite" ADD COLUMN     "showAbout" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showContact" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showEducation" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showExperience" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showHero" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showInsights" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showProjects" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showServices" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showSkills" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showTestimonials" BOOLEAN NOT NULL DEFAULT true;
