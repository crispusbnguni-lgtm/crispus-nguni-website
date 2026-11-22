-- Prevent multiple availability exceptions for the same
-- portfolio and calendar date.
--
-- Existing records were audited:
-- 4 exceptions, 4 unique portfolio/date combinations.
-- No duplicate records require cleanup.

CREATE UNIQUE INDEX "AvailabilityException_portfolioId_date_key"
ON "AvailabilityException"("portfolioId", "date");