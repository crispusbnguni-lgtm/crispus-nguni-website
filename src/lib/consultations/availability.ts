
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  getTimezoneParts,
  getZonedDateTimeCandidates,
  isValidIanaTimezone,
  zonedDateTimeToUtc,
  getZonedDayRange,
} from "./timezone-core";

export {
  getZonedDateTimeCandidates,
  getZonedDayRange,
  isValidIanaTimezone,
  zonedDateTimeToUtc,
};

export type AvailabilitySlot = {
  start: Date;
  end: Date;
  timezone: string;
};

type GetAvailabilitySlotsInput = {
  portfolioId: string;
  consultationTypeId: string;
  startDate: Date;
  endDate: Date;
  client?: Prisma.TransactionClient;
};

type ConsultationTypeConfig = {
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minimumNoticeMinutes: number;
  maximumAdvanceDays: number;
  active: boolean;
};

type AvailabilityRuleConfig = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  enabled: boolean;
};

type AvailabilityExceptionConfig = {
  date: Date;
  type: "UNAVAILABLE" | "CUSTOM_HOURS";
  startTime: string | null;
  endTime: string | null;
};

type ExistingConsultation = {
  scheduledAt: Date;
  durationMinutes: number;
  consultationType: {
    bufferBeforeMinutes: number;
    bufferAfterMinutes: number;
  };
};

function addUtcDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function overlaps(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
) {
  return (
    startA.getTime() < endB.getTime() &&
    endA.getTime() > startB.getTime()
  );
}

function isInsideRange(
  start: Date,
  end: Date,
  rangeStart: Date,
  rangeEnd: Date,
) {
  return (
    start.getTime() >= rangeStart.getTime() &&
    end.getTime() <= rangeEnd.getTime()
  );
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function getLocalDayOfWeek(
  date: Date,
  timezone: string,
) {
  const parts = getTimezoneParts(date, timezone);

  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
    ),
  ).getUTCDay();
}

function getLocalDateKey(
  date: Date,
  timezone: string,
) {
  const parts = getTimezoneParts(date, timezone);

  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day,
  ).padStart(2, "0")}`;
}

function getExceptionForDate(
  exceptions: AvailabilityExceptionConfig[],
  date: Date,
  timezone: string,
) {
  const localDateKey = getLocalDateKey(date, timezone);

  const matches = exceptions.filter((exception) => {
    const exceptionDate = exception.date.toISOString().slice(0, 10);

    return exceptionDate === localDateKey;
  });

  if (matches.length > 1) {
    throw new Error(
      `Multiple availability exceptions exist for ${localDateKey}. Resolve the duplicate exceptions before generating availability.`,
    );
  }

  return matches[0];
}

function getEffectivePeriods(
  date: Date,
  rules: AvailabilityRuleConfig[],
  exceptions: AvailabilityExceptionConfig[],
  timezone: string,
) {
  const exception = getExceptionForDate(
    exceptions,
    date,
    timezone,
  );

  if (exception?.type === "UNAVAILABLE") {
    return [];
  }

  // Custom hours replace weekly hours for this local date.
  // This also works when no weekly rules exist.
  if (
    exception?.type === "CUSTOM_HOURS" &&
    exception.startTime &&
    exception.endTime
  ) {
    return [
      {
        startTime: exception.startTime,
        endTime: exception.endTime,
        timezone,
      },
    ];
  }

  const localDay = getLocalDayOfWeek(date, timezone);

  return rules
    .filter(
      (rule) =>
        rule.enabled &&
        rule.dayOfWeek === localDay,
    )
    .map((rule) => ({
      startTime: rule.startTime,
      endTime: rule.endTime,
      timezone,
    }));
}

function buildCandidateSlots(
  date: Date,
  period: {
    startTime: string;
    endTime: string;
    timezone: string;
  },
  consultationType: ConsultationTypeConfig,
) {
  if (
    !isValidTime(period.startTime) ||
    !isValidTime(period.endTime)
  ) {
    return [];
  }

  const [startHour, startMinute] = period.startTime
    .split(":")
    .map(Number);

  const [endHour, endMinute] = period.endTime
    .split(":")
    .map(Number);

  const dateParts = getTimezoneParts(
    date,
    period.timezone,
  );

  const startCandidates = getZonedDateTimeCandidates(
    dateParts.year,
    dateParts.month,
    dateParts.day,
    startHour,
    startMinute,
    period.timezone,
  );

  const endCandidates = getZonedDateTimeCandidates(
    dateParts.year,
    dateParts.month,
    dateParts.day,
    endHour,
    endMinute,
    period.timezone,
  );

  // Never shift nonexistent local availability boundaries
  // into a different local time.
  if (
    startCandidates.length === 0 ||
    endCandidates.length === 0
  ) {
    return [];
  }

  // During a repeated hour, use the first occurrence for the
  // opening boundary and the last occurrence for the closing
  // boundary. This preserves the full UTC availability window.
  const periodStart = startCandidates[0];
  const periodEnd = endCandidates[endCandidates.length - 1];

  if (periodEnd.getTime() <= periodStart.getTime()) {
    return [];
  }

  const duration = consultationType.durationMinutes;
  const bufferBefore = consultationType.bufferBeforeMinutes;
  const bufferAfter = consultationType.bufferAfterMinutes;

  const totalSlotMinutes =
    bufferBefore + duration + bufferAfter;

  const periodMinutes = Math.floor(
    (periodEnd.getTime() - periodStart.getTime()) / 60000,
  );

  if (
    totalSlotMinutes <= 0 ||
    periodMinutes < totalSlotMinutes
  ) {
    return [];
  }

  const slots: AvailabilitySlot[] = [];

  // Advance on the UTC timeline. During a fall-back transition,
  // this naturally visits both occurrences of repeated local times.
  let cursor = new Date(periodStart);

  while (
    Math.floor(
      (periodEnd.getTime() - cursor.getTime()) / 60000,
    ) >= totalSlotMinutes
  ) {
    const slotStart = new Date(
      cursor.getTime() + bufferBefore * 60000,
    );

    const slotEnd = new Date(
      slotStart.getTime() + duration * 60000,
    );

    slots.push({
      start: slotStart,
      end: slotEnd,
      timezone: period.timezone,
    });

    cursor = new Date(
      cursor.getTime() + totalSlotMinutes * 60000,
    );
  }

  return slots;
}

function removeOverlappingSlots(
  slots: AvailabilitySlot[],
  consultations: ExistingConsultation[],
  candidateBufferBeforeMinutes: number,
  candidateBufferAfterMinutes: number,
) {
  return slots.filter((slot) => {
    return !consultations.some((consultation) => {
      const consultationStart = new Date(
        consultation.scheduledAt.getTime() -
          consultation.consultationType.bufferBeforeMinutes *
            60000,
      );

      const consultationEnd = new Date(
        consultation.scheduledAt.getTime() +
          consultation.durationMinutes * 60000 +
          consultation.consultationType.bufferAfterMinutes *
            60000,
      );

      const candidateStart = new Date(
        slot.start.getTime() -
          candidateBufferBeforeMinutes * 60000,
      );

      const candidateEnd = new Date(
        slot.end.getTime() +
          candidateBufferAfterMinutes * 60000,
      );

      return overlaps(
        candidateStart,
        candidateEnd,
        consultationStart,
        consultationEnd,
      );
    });
  });
}

export async function getAvailabilitySlots({
  portfolioId,
  consultationTypeId,
  startDate,
  endDate,
  client,
}: GetAvailabilitySlotsInput): Promise<AvailabilitySlot[]> {
  if (!portfolioId) {
    throw new Error("Portfolio ID is required.");
  }

  if (!consultationTypeId) {
    throw new Error("Consultation type ID is required.");
  }

  if (
    !(startDate instanceof Date) ||
    !(endDate instanceof Date) ||
    !Number.isFinite(startDate.getTime()) ||
    !Number.isFinite(endDate.getTime()) ||
    startDate.getTime() >= endDate.getTime()
  ) {
    throw new Error("A valid availability date range is required.");
  }

  // Booking routes can pass their transaction client so availability
  // reads participate in the same transaction as the booking operation.
  const db = client ?? prisma;

  const portfolio = await db.portfolioSite.findUnique({
    where: { id: portfolioId },
    select: {
      timezone: true,
      timezoneReviewRequired: true,
    },
  });

  if (!portfolio) {
    throw new Error("Portfolio not found.");
  }

  if (
    portfolio.timezoneReviewRequired ||
    !isValidIanaTimezone(portfolio.timezone)
  ) {
    throw new Error(
      "The portfolio timezone requires review before booking can continue.",
    );
  }

  const portfolioTimezone = portfolio.timezone;

  const consultationType = await db.consultationType.findFirst({
    where: {
      id: consultationTypeId,
      portfolioId,
    },
    select: {
      durationMinutes: true,
      bufferBeforeMinutes: true,
      bufferAfterMinutes: true,
      minimumNoticeMinutes: true,
      maximumAdvanceDays: true,
      active: true,
    },
  });

  if (!consultationType) {
    throw new Error("Consultation type not found.");
  }

  if (!consultationType.active) {
    return [];
  }

  const now = new Date();

  const minimumBookingTime = new Date(
    now.getTime() +
      consultationType.minimumNoticeMinutes * 60000,
  );

  const maximumBookingTime = new Date(
    now.getTime() +
      consultationType.maximumAdvanceDays * 24 * 60 * 60000,
  );

  const requestedStart =
    startDate.getTime() < minimumBookingTime.getTime()
      ? minimumBookingTime
      : startDate;

  const requestedEnd =
    endDate.getTime() > maximumBookingTime.getTime()
      ? maximumBookingTime
      : endDate;

  if (requestedStart.getTime() >= requestedEnd.getTime()) {
    return [];
  }

  const firstLocalDate = getLocalDateKey(
    requestedStart,
    portfolioTimezone,
  );

  const lastLocalDate = getLocalDateKey(
    requestedEnd,
    portfolioTimezone,
  );

  const firstDate = new Date(
    `${firstLocalDate}T00:00:00.000Z`,
  );

  const lastDate = new Date(
    `${lastLocalDate}T00:00:00.000Z`,
  );

  const rules = await db.availabilityRule.findMany({
    where: {
      portfolioId,
      enabled: true,
    },
    select: {
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      enabled: true,
    },
    orderBy: [
      { dayOfWeek: "asc" },
      { startTime: "asc" },
    ],
  });

  const exceptions = await db.availabilityException.findMany({
    where: {
      portfolioId,
      date: {
        gte: firstDate,
        lte: lastDate,
      },
    },
    select: {
      date: true,
      type: true,
      startTime: true,
      endTime: true,
    },
    orderBy: {
      date: "asc",
    },
  });

  // Determine the maximum existing appointment occupancy.
  // Existing appointments can overlap the requested range because
  // of their duration, after-buffer, or the candidate's before-buffer.
  const consultationTypes = await db.consultationType.findMany({
    where: {
      portfolioId,
    },
    select: {
      durationMinutes: true,
      bufferBeforeMinutes: true,
      bufferAfterMinutes: true,
    },
  });

  const maximumExistingOccupancyMinutes = consultationTypes.reduce(
    (maximum, type) =>
      Math.max(
        maximum,
        type.durationMinutes + type.bufferAfterMinutes,
      ),
    0,
  );

  const maximumExistingBufferBeforeMinutes =
    consultationTypes.reduce(
      (maximum, type) =>
        Math.max(maximum, type.bufferBeforeMinutes),
      0,
    );

  const consultationLookbackMinutes =
    consultationType.bufferBeforeMinutes +
    maximumExistingOccupancyMinutes;

  const consultationLookbackStart = new Date(
    requestedStart.getTime() -
      consultationLookbackMinutes * 60000,
  );

  // Include future appointments whose before-buffer may overlap
  // the candidate's after-buffer, even when they start after requestedEnd.
  const consultationLookaheadEnd = new Date(
    requestedEnd.getTime() +
      (
        consultationType.bufferAfterMinutes +
        maximumExistingBufferBeforeMinutes
      ) * 60000,
  );

  const consultations = await db.consultation.findMany({
    where: {
      portfolioId,
      scheduledAt: {
        lt: consultationLookaheadEnd,
        gte: consultationLookbackStart,
      },
      status: {
        in: ["PENDING", "CONFIRMED"],
      },
    },
    select: {
      scheduledAt: true,
      durationMinutes: true,
      consultationType: {
        select: {
          bufferBeforeMinutes: true,
          bufferAfterMinutes: true,
        },
      },
    },
  });

  const allSlots: AvailabilitySlot[] = [];

  let calendarDate = new Date(
    `${firstLocalDate}T12:00:00.000Z`,
  );

  const finalCalendarDate = new Date(
    `${lastLocalDate}T12:00:00.000Z`,
  );

  while (
    calendarDate.getTime() <= finalCalendarDate.getTime()
  ) {
    const year = calendarDate.getUTCFullYear();
    const month = calendarDate.getUTCMonth() + 1;
    const day = calendarDate.getUTCDate();

    const localNoon = zonedDateTimeToUtc(
      year,
      month,
      day,
      12,
      0,
      portfolioTimezone,
    );

    const periods = getEffectivePeriods(
      localNoon,
      rules,
      exceptions,
      portfolioTimezone,
    );

    for (const period of periods) {
      const candidateSlots = buildCandidateSlots(
        localNoon,
        period,
        consultationType,
      );

      for (const slot of candidateSlots) {
        if (
          !isInsideRange(
            slot.start,
            slot.end,
            requestedStart,
            requestedEnd,
          )
        ) {
          continue;
        }

        if (
          slot.start.getTime() <
          minimumBookingTime.getTime()
        ) {
          continue;
        }

        if (
          slot.end.getTime() >
          maximumBookingTime.getTime()
        ) {
          continue;
        }

        allSlots.push(slot);
      }
    }

    calendarDate = addUtcDays(calendarDate, 1);
  }

  const availableSlots = removeOverlappingSlots(
    allSlots,
    consultations,
    consultationType.bufferBeforeMinutes,
    consultationType.bufferAfterMinutes,
  );

  // Overlapping weekly rules can generate identical slots.
  // Deduplicate by their actual UTC start and end instants.
  const uniqueSlots = new Map<string, AvailabilitySlot>();

  for (const slot of availableSlots) {
    const key = `${slot.start.getTime()}:${slot.end.getTime()}`;

    if (!uniqueSlots.has(key)) {
      uniqueSlots.set(key, slot);
    }
  }

  return Array.from(uniqueSlots.values()).sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
}
