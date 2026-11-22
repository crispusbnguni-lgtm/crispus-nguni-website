-- Enforce one availability exception per portfolio per calendar date.
--
-- Prisma's existing @@unique([portfolioId, date]) remains in place.
-- This additional expression index prevents different timestamps on
-- the same calendar date from bypassing the intended uniqueness rule.
--
-- The application normalizes date-only input to UTC midnight.
-- Existing records were audited before this migration was prepared.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public."AvailabilityException"
        GROUP BY "portfolioId", "date"::date
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Cannot create calendar-date unique index: duplicate availability exceptions exist for a portfolio and calendar date.';
    END IF;
END;
$$;

CREATE UNIQUE INDEX "AvailabilityException_portfolioId_calendar_date_key"
ON public."AvailabilityException" ("portfolioId", ("date"::date));

COMMENT ON INDEX public."AvailabilityException_portfolioId_calendar_date_key"
IS 'Enforces one availability exception per portfolio per calendar date; complements Prisma exact-timestamp uniqueness.';