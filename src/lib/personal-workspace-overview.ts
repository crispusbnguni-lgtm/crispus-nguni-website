import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getTimezoneParts,
  getZonedDayRange,
  isValidIanaTimezone,
} from "@/lib/consultations/timezone-core";
import { DEFAULT_WORKSPACE_PREFERENCES } from "@/lib/personal-workspace-core";

function localDateKey(date: Date, timezone: string): string {
  const parts = getTimezoneParts(date, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function addCalendarDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, "0")}-${String(result.getUTCDate()).padStart(2, "0")}`;
}

export async function getPersonalWorkspaceOverview(
  userId: string,
  now = new Date(),
  client: typeof prisma = prisma,
) {
  const [workspace, portfolio] = await Promise.all([
    client.personalWorkspace.findUnique({
      where: { userId },
      select: {
        mode: true,
        focusAreas: true,
        timezone: true,
        workingHoursStart: true,
        workingHoursEnd: true,
        breakMinutes: true,
        weekStartsOn: true,
        revision: true,
        onboardingCompletedAt: true,
        updatedAt: true,
      },
    }),
    client.portfolioSite.findUnique({
      where: { userId },
      select: { id: true, name: true },
    }),
  ]);

  const timezone =
    workspace && isValidIanaTimezone(workspace.timezone)
      ? workspace.timezone
      : DEFAULT_WORKSPACE_PREFERENCES.timezone;
  const today = localDateKey(now, timezone);
  const todayRange = getZonedDayRange(today, timezone);
  const horizon = getZonedDayRange(addCalendarDays(today, 6), timezone);

  if (!portfolio) {
    return {
      workspace,
      timezone,
      today,
      todayRange,
      appointments: [],
      followUps: [],
      todayAppointmentCount: 0,
      upcomingAppointmentCount: 0,
      followUpCount: 0,
      overdueFollowUpCount: 0,
      portfolioName: null,
    };
  }

  const appointmentBaseWhere = {
    portfolioId: portfolio.id,
    status: { in: ["PENDING", "CONFIRMED"] },
  } satisfies Prisma.ConsultationWhereInput;
  const activeFollowUpWhere = {
    portfolioId: portfolio.id,
    status: { notIn: ["CONVERTED", "LOST"] },
  } satisfies Prisma.LeadWhereInput;
  const [
    appointments,
    followUps,
    todayAppointmentCount,
    upcomingAppointmentCount,
    followUpCount,
    overdueFollowUpCount,
  ] = await Promise.all([
    client.consultation.findMany({
      where: {
        ...appointmentBaseWhere,
        scheduledAt: {
          gte: todayRange.startDate,
          lt: horizon.endDate,
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: 12,
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        timezone: true,
        durationMinutes: true,
        status: true,
        consultationType: { select: { title: true } },
      },
    }),
    client.lead.findMany({
      where: {
        ...activeFollowUpWhere,
        nextFollowUpAt: { lt: todayRange.endDate },
      },
      orderBy: { nextFollowUpAt: "asc" },
      take: 8,
      select: {
        id: true,
        name: true,
        status: true,
        temperature: true,
        nextFollowUpAt: true,
      },
    }),
    client.consultation.count({
      where: {
        ...appointmentBaseWhere,
        scheduledAt: { gte: todayRange.startDate, lt: todayRange.endDate },
      },
    }),
    client.consultation.count({
      where: {
        ...appointmentBaseWhere,
        scheduledAt: { gte: now, lt: horizon.endDate },
      },
    }),
    client.lead.count({
      where: { ...activeFollowUpWhere, nextFollowUpAt: { lt: todayRange.endDate } },
    }),
    client.lead.count({
      where: { ...activeFollowUpWhere, nextFollowUpAt: { lt: now } },
    }),
  ]);

  return {
    workspace,
    timezone,
    today,
    todayRange,
    appointments,
    followUps,
    todayAppointmentCount,
    upcomingAppointmentCount,
    followUpCount,
    overdueFollowUpCount,
    portfolioName: portfolio.name,
  };
}
