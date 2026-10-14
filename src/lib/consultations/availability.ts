import { prisma } from "@/lib/prisma";

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
  timezone: string;
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

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
  );
}

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

function getTimezoneParts(
  date: Date,
  timezone: string,
) {
  const formatter = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    },
  );

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
) {
  const parts = getTimezoneParts(
    date,
    timezone,
  );

  const utcRepresentation = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return (
    utcRepresentation -
    date.getTime()
  );
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
) {
  const approximateUtc = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      0,
      0,
    ),
  );

  const firstOffset =
    getTimezoneOffsetMilliseconds(
      approximateUtc,
      timezone,
    );

  let result = new Date(
    approximateUtc.getTime() -
      firstOffset,
  );

  const secondOffset =
    getTimezoneOffsetMilliseconds(
      result,
      timezone,
    );

  if (secondOffset !== firstOffset) {
    result = new Date(
      approximateUtc.getTime() -
        secondOffset,
    );
  }

  return result;
}

function getLocalDayOfWeek(
  date: Date,
  timezone: string,
) {
  const parts = getTimezoneParts(
    date,
    timezone,
  );

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
  const parts = getTimezoneParts(
    date,
    timezone,
  );

  return `${parts.year}-${String(
    parts.month,
  ).padStart(2, "0")}-${String(
    parts.day,
  ).padStart(2, "0")}`;
}

function getExceptionForDate(
  exceptions: AvailabilityExceptionConfig[],
  date: Date,
  timezone: string,
) {
  const localDateKey = getLocalDateKey(
    date,
    timezone,
  );

  return exceptions.find((exception) => {
    const exceptionDate =
      exception.date.toISOString().slice(0, 10);

    return exceptionDate === localDateKey;
  });
}

function getEffectivePeriods(
  date: Date,
  rule: AvailabilityRuleConfig,
  exceptions: AvailabilityExceptionConfig[],
) {
  const exception = getExceptionForDate(
    exceptions,
    date,
    rule.timezone,
  );

  if (exception?.type === "UNAVAILABLE") {
    return [];
  }

  if (
    exception?.type === "CUSTOM_HOURS" &&
    exception.startTime &&
    exception.endTime
  ) {
    return [
      {
        startTime: exception.startTime,
        endTime: exception.endTime,
        timezone: rule.timezone,
      },
    ];
  }

  if (
    rule.enabled &&
    getLocalDayOfWeek(
      date,
      rule.timezone,
    ) === rule.dayOfWeek
  ) {
    return [
      {
        startTime: rule.startTime,
        endTime: rule.endTime,
        timezone: rule.timezone,
      },
    ];
  }

  return [];
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

  const [startHour, startMinute] =
    period.startTime.split(":").map(Number);

  const [endHour, endMinute] =
    period.endTime.split(":").map(Number);

  const dateParts =
    getTimezoneParts(
      date,
      period.timezone,
    );

  const periodStart =
    zonedDateTimeToUtc(
      dateParts.year,
      dateParts.month,
      dateParts.day,
      startHour,
      startMinute,
      period.timezone,
    );

  const periodEnd =
    zonedDateTimeToUtc(
      dateParts.year,
      dateParts.month,
      dateParts.day,
      endHour,
      endMinute,
      period.timezone,
    );

  if (
    periodEnd.getTime() <=
    periodStart.getTime()
  ) {
    return [];
  }

  const duration =
    consultationType.durationMinutes;

  const bufferBefore =
    consultationType.bufferBeforeMinutes;

  const bufferAfter =
    consultationType.bufferAfterMinutes;

  const totalSlotMinutes =
    bufferBefore +
    duration +
    bufferAfter;

  const periodMinutes =
    Math.floor(
      (periodEnd.getTime() -
        periodStart.getTime()) /
        60000,
    );

  if (
    periodMinutes <
    totalSlotMinutes
  ) {
    return [];
  }

  const slots: AvailabilitySlot[] = [];

  let cursor = new Date(
    periodStart,
  );

  while (
    Math.floor(
      (periodEnd.getTime() -
        cursor.getTime()) /
        60000,
    ) >= totalSlotMinutes
  ) {
    const slotStart =
      new Date(
        cursor.getTime() +
          bufferBefore * 60000,
      );

    const slotEnd =
      new Date(
        slotStart.getTime() +
          duration * 60000,
      );

    slots.push({
      start: slotStart,
      end: slotEnd,
      timezone: period.timezone,
    });

    cursor =
      new Date(
        cursor.getTime() +
          totalSlotMinutes * 60000,
      );
  }

  return slots;
}

function removeOverlappingSlots(
  slots: AvailabilitySlot[],
  consultations: ExistingConsultation[],
) {
  return slots.filter((slot) => {
    return !consultations.some(
      (consultation) => {
        const consultationStart =
          new Date(
            consultation.scheduledAt.getTime() -
              consultation.consultationType
                .bufferBeforeMinutes *
                60000,
          );

        const consultationEnd =
          new Date(
            consultation.scheduledAt.getTime() +
              consultation.durationMinutes *
                60000 +
              consultation.consultationType
                .bufferAfterMinutes *
                60000,
          );

        return overlaps(
          slot.start,
          slot.end,
          consultationStart,
          consultationEnd,
        );
      },
    );
  });
}

export async function getAvailabilitySlots({
  portfolioId,
  consultationTypeId,
  startDate,
  endDate,
}: GetAvailabilitySlotsInput): Promise<
  AvailabilitySlot[]
> {
  if (!portfolioId) {
    throw new Error(
      "Portfolio ID is required.",
    );
  }

  if (!consultationTypeId) {
    throw new Error(
      "Consultation type ID is required.",
    );
  }

  const consultationType =
    await prisma.consultationType.findFirst({
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
    throw new Error(
      "Consultation type not found.",
    );
  }

  if (!consultationType.active) {
    return [];
  }

  const now = new Date();

  const minimumBookingTime =
    new Date(
      now.getTime() +
        consultationType.minimumNoticeMinutes *
          60000,
    );

  const maximumBookingTime =
    new Date(
      now.getTime() +
        consultationType.maximumAdvanceDays *
          24 *
          60 *
          60000,
    );

  const requestedStart =
    startDate.getTime() <
    minimumBookingTime.getTime()
      ? minimumBookingTime
      : startDate;

  const requestedEnd =
    endDate.getTime() >
    maximumBookingTime.getTime()
      ? maximumBookingTime
      : endDate;

  if (
    requestedStart.getTime() >=
    requestedEnd.getTime()
  ) {
    return [];
  }

  const rules =
    await prisma.availabilityRule.findMany({
      where: {
        portfolioId,
        enabled: true,
      },
      select: {
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        timezone: true,
        enabled: true,
      },
      orderBy: [
        {
          dayOfWeek: "asc",
        },
        {
          startTime: "asc",
        },
      ],
    });

  const exceptions =
    await prisma.availabilityException.findMany({
      where: {
        portfolioId,
        date: {
          gte: startOfUtcDay(
            requestedStart,
          ),
          lte: startOfUtcDay(
            requestedEnd,
          ),
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

  const consultations =
    await prisma.consultation.findMany({
      where: {
        portfolioId,
        scheduledAt: {
          lt: requestedEnd,
          gte: new Date(
            requestedStart.getTime() -
              24 * 60 * 60000,
          ),
        },
        status: {
          in: [
            "PENDING",
            "CONFIRMED",
          ],
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

  let currentDate =
    startOfUtcDay(
      requestedStart,
    );

  const finalDate =
    startOfUtcDay(
      requestedEnd,
    );

  while (
    currentDate.getTime() <=
    finalDate.getTime()
  ) {
    for (const rule of rules) {
      const periods =
        getEffectivePeriods(
          currentDate,
          rule,
          exceptions,
        );

      for (const period of periods) {
        const candidateSlots =
          buildCandidateSlots(
            currentDate,
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
    }

    currentDate =
      addUtcDays(
        currentDate,
        1,
      );
  }

  const availableSlots =
    removeOverlappingSlots(
      allSlots,
      consultations,
    );

  return availableSlots.sort(
    (a, b) =>
      a.start.getTime() -
      b.start.getTime(),
  );
}