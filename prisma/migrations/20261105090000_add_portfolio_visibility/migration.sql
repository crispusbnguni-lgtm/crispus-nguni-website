-- CreateEnum
CREATE TYPE "PortfolioVisibility" AS ENUM ('PUBLIC', 'UNLISTED');

-- AlterTable
ALTER TABLE "PortfolioSite"
ADD COLUMN "visibility" "PortfolioVisibility" NOT NULL DEFAULT 'PUBLIC';