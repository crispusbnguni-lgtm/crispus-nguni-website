-- Establish one authoritative timezone per portfolio.
ALTER TABLE "PortfolioSite"
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Africa/Nairobi',
  ADD COLUMN "timezoneReviewRequired" BOOLEAN NOT NULL DEFAULT FALSE;

-- Preserve a legacy timezone only when all rules agree and PostgreSQL
-- recognizes that value as an IANA timezone. Conflicts or invalid values
-- retain the safe default and require an owner to review the schedule.
WITH rule_timezones AS (
  SELECT
    rule."portfolioId",
    COUNT(DISTINCT rule."timezone") AS timezone_count,
    MIN(rule."timezone") AS sole_timezone,
    BOOL_AND(EXISTS (
      SELECT 1
      FROM pg_timezone_names AS known_zone
      WHERE known_zone.name = rule."timezone"
    )) AS all_timezones_valid
  FROM "AvailabilityRule" AS rule
  GROUP BY rule."portfolioId"
)
UPDATE "PortfolioSite" AS portfolio
SET
  "timezone" = CASE
    WHEN rules.timezone_count = 1 AND rules.all_timezones_valid
      THEN rules.sole_timezone
    ELSE 'Africa/Nairobi'
  END,
  "timezoneReviewRequired" = (
    rules.timezone_count <> 1 OR NOT rules.all_timezones_valid
  )
FROM rule_timezones AS rules
WHERE portfolio."id" = rules."portfolioId";
