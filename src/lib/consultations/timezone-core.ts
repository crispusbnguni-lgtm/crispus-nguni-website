
/**
 * Pure timezone utilities.
 * This module deliberately has no database or application dependencies,
 * allowing Node's built-in test runner to exercise production logic.
 */

export type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function isValidIanaTimezone(timezone: string): boolean {
  if (!timezone || timezone.length > 100) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
    });

    return true;
  } catch {
    return false;
  }
}

export function getTimezoneParts(
  date: Date,
  timezone: string,
): ZonedDateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const values: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function getTimezoneOffsetMilliseconds(
  date: Date,
  timezone: string,
): number {
  const parts = getTimezoneParts(date, timezone);

  const utcRepresentation = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return utcRepresentation - date.getTime();
}

/**
 * Returns every UTC instant corresponding to a local wall-clock time.
 *
 * []       = nonexistent time during a spring-forward transition.
 * [date]   = ordinary, unambiguous time.
 * [date, date] = repeated time during a fall-back transition.
 *
 * Results are sorted chronologically.
 */
export function getZonedDateTimeCandidates(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date[] {
  if (!isValidIanaTimezone(timezone)) {
    throw new Error("Invalid timezone.");
  }

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error("Invalid local date or time.");
  }

  const wallClock = new Date(
    Date.UTC(year, month - 1, day, hour, minute, 0, 0),
  );

  if (
    wallClock.getUTCFullYear() !== year ||
    wallClock.getUTCMonth() !== month - 1 ||
    wallClock.getUTCDate() !== day ||
    wallClock.getUTCHours() !== hour ||
    wallClock.getUTCMinutes() !== minute
  ) {
    throw new Error("Invalid calendar date or local time.");
  }

  const offsets = new Set<number>();

  for (let hours = -48; hours <= 48; hours += 6) {
    const sample = new Date(
      wallClock.getTime() + hours * 60 * 60 * 1000,
    );

    offsets.add(
      getTimezoneOffsetMilliseconds(sample, timezone),
    );
  }

  const candidates = new Map<number, Date>();

  for (const offset of offsets) {
    const candidate = new Date(
      wallClock.getTime() - offset,
    );

    const parts = getTimezoneParts(candidate, timezone);

    if (
      parts.year === year &&
      parts.month === month &&
      parts.day === day &&
      parts.hour === hour &&
      parts.minute === minute &&
      parts.second === 0
    ) {
      candidates.set(candidate.getTime(), candidate);
    }
  }

  return [...candidates.values()].sort(
    (a, b) => a.getTime() - b.getTime(),
  );
}

/**
 * Converts a local wall-clock time to UTC only when it has
 * exactly one valid UTC representation.
 *
 * Nonexistent and ambiguous appointment times are rejected.
 */
export function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  const candidates = getZonedDateTimeCandidates(
    year,
    month,
    day,
    hour,
    minute,
    timezone,
  );

  if (candidates.length === 0) {
    throw new Error(
      "This local time does not exist because of a timezone clock change.",
    );
  }

  if (candidates.length > 1) {
    throw new Error(
      "This local time occurs more than once because of a timezone clock change.",
    );
  }

  return candidates[0];
}

/**
 * Resolves the first valid UTC instant belonging to a local calendar date.
 *
 * Behaviour:
 * - Ordinary midnight: returns its unique UTC instant.
 * - Ambiguous midnight: returns its earliest UTC occurrence.
 * - Nonexistent midnight: finds the first valid minute of that date.
 * - Entirely skipped date: resolves to the first valid instant of
 *   the next local calendar date.
 *
 * This function is exclusively for calendar-day boundaries.
 * It does not alter appointment-time conversion semantics.
 */
function getEarliestZonedDateTime(
  year: number,
  month: number,
  day: number,
  timezone: string,
): Date {
  const baseDate = new Date(
    Date.UTC(year, month - 1, day),
  );

  // Search the requested date and, if it was skipped,
  // the following dates for the first valid local boundary.
  for (let dayOffset = 0; dayOffset <= 2; dayOffset += 1) {
    const candidateDate = new Date(
      baseDate.getTime() +
        dayOffset * 24 * 60 * 60 * 1000,
    );

    const candidateYear = candidateDate.getUTCFullYear();
    const candidateMonth = candidateDate.getUTCMonth() + 1;
    const candidateDay = candidateDate.getUTCDate();

    // Check each hour boundary in chronological local order.
    for (let hour = 0; hour < 24; hour += 1) {
      const candidates = getZonedDateTimeCandidates(
        candidateYear,
        candidateMonth,
        candidateDay,
        hour,
        0,
        timezone,
      );

      if (candidates.length > 0) {
        // If midnight was skipped, search the preceding hour
        // for the first valid minute.
        if (hour > 0) {
          for (let minute = 1; minute < 60; minute += 1) {
            const earlierCandidates =
              getZonedDateTimeCandidates(
                candidateYear,
                candidateMonth,
                candidateDay,
                hour - 1,
                minute,
                timezone,
              );

            if (earlierCandidates.length > 0) {
              return earlierCandidates[0];
            }
          }
        }

        // For ambiguous boundaries, use the earliest occurrence.
        return candidates[0];
      }
    }
  }

  throw new Error(
    "Could not resolve a valid calendar boundary in this timezone.",
  );
}

/**
 * Returns the UTC interval covering a local calendar date.
 *
 * The interval is [startDate, endDate).
 *
 * Consequently:
 * - A normal day may be 24 hours.
 * - A spring-forward day may be 23 hours.
 * - A fall-back day may be 25 hours.
 * - A completely skipped local date has an empty interval.
 */
export function getZonedDayRange(
  dateKey: string,
  timezone: string,
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dateKey) ||
    !isValidIanaTimezone(timezone)
  ) {
    throw new Error("Invalid local date or timezone.");
  }

  const [year, month, day] = dateKey.split("-").map(Number);

  const check = new Date(
    Date.UTC(year, month - 1, day),
  );

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new Error("Invalid calendar date.");
  }

  const next = new Date(
    Date.UTC(year, month - 1, day + 1),
  );

  return {
    startDate: getEarliestZonedDateTime(
      year,
      month,
      day,
      timezone,
    ),

    endDate: getEarliestZonedDateTime(
      next.getUTCFullYear(),
      next.getUTCMonth() + 1,
      next.getUTCDate(),
      timezone,
    ),
  };
}
