-- Add slug temporarily as nullable
ALTER TABLE "PortfolioSite"
ADD COLUMN "slug" TEXT;

-- Give existing portfolio records unique slugs
UPDATE "PortfolioSite"
SET "slug" = CASE
  WHEN "name" IS NOT NULL AND TRIM("name") <> ''
    THEN LOWER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(TRIM("name"), '[^a-zA-Z0-9]+', '-', 'g'),
        '(^-|-$)',
        '',
        'g'
      )
    ) || '-' || SUBSTRING("id", 1, 6)
  ELSE 'portfolio-' || SUBSTRING("id", 1, 6)
END;

-- Make slug required
ALTER TABLE "PortfolioSite"
ALTER COLUMN "slug" SET NOT NULL;

-- Make slug unique
CREATE UNIQUE INDEX "PortfolioSite_slug_key"
ON "PortfolioSite"("slug");