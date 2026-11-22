
import { NextResponse } from "next/server";
import { ConsultationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  getAvailabilitySlots,
  getZonedDayRange,
  isValidIanaTimezone,
} from "@/lib/consultations/availability";
import { recalculateLeadScore } from "@/lib/lead-crm";
import { requireSameOriginApiRequest } from "@/lib/authorization";

export const dynamic = "force-dynamic";

function text(value: unknown, maxLength = 2000): string | null {
  if (typeof value !== "string") return null;

  const result = value.trim();
  return result ? result.slice(0, maxLength) : null;
}

function canAccessPortfolio(
  role: string,
  userId: string,
  portfolioUserId: string,
) {
  return role === "SUPER_ADMIN" || userId === portfolioUserId;
}

function getDateKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return `${values.year}-${values.month}-${values.day}`;
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const requestedPortfolioId = searchParams.get("portfolioId");

    const consultations = await prisma.consultation.findMany({
      where: {
        ...(user.role === "SUPER_ADMIN"
          ? requestedPortfolioId
            ? { portfolioId: requestedPortfolioId }
            : {}
          : {
              portfolio: {
                is: { userId: user.id },
              },
            }),
      },
      orderBy: { scheduledAt: "desc" },
      take: 100,
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        portfolio: {
          select: {
            id: true,
            name: true,
            slug: true,
            userId: true,
          },
        },
        consultationType: true,
      },
    });

    return NextResponse.json({
      success: true,
      consultations,
    });
  } catch (error) {
    console.error("GET /api/consultation failed:", error);

    return NextResponse.json(
      { success: false, message: "Unable to retrieve consultations." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const originResponse = requireSameOriginApiRequest(request);
    if (originResponse) return originResponse;

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 },
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request body." },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;

    const portfolioId = text(data.portfolioId, 100);
    const leadId = text(data.leadId, 100);
    const consultationTypeId = text(data.consultationTypeId, 100);
    const title = text(data.title, 200);
    const meetingMethod = text(data.meetingMethod, 100);
    const meetingUrl = text(data.meetingUrl, 1000);
    const meetingLocation = text(data.meetingLocation, 500);
    const notes = text(data.notes, 5000);
    const scheduledAtValue = text(data.scheduledAt, 100);

    if (
      !portfolioId ||
      !leadId ||
      !consultationTypeId ||
      !title ||
      !scheduledAtValue
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Portfolio, lead, consultation type, title, and scheduled time are required.",
        },
        { status: 400 },
      );
    }

    const scheduledAt = new Date(scheduledAtValue);

    if (
      Number.isNaN(scheduledAt.getTime()) ||
      !/^\d{4}-\d{2}-\d{2}T/.test(scheduledAtValue)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid scheduled date and time." },
        { status: 400 },
      );
    }

    const portfolio = await prisma.portfolioSite.findUnique({
      where: { id: portfolioId },
      select: {
        id: true,
        userId: true,
        published: true,
        timezone: true,
        timezoneReviewRequired: true,
      },
    });

    if (
      !portfolio ||
      !canAccessPortfolio(user.role, user.id, portfolio.userId)
    ) {
      return NextResponse.json(
        { success: false, message: "Portfolio not found." },
        { status: 404 },
      );
    }

    if (
      portfolio.timezoneReviewRequired ||
      !isValidIanaTimezone(portfolio.timezone)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Resolve the portfolio timezone before scheduling consultations.",
        },
        { status: 409 },
      );
    }

    const timezone = portfolio.timezone;

    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        portfolioId: portfolio.id,
      },
      select: { id: true },
    });

    if (!lead) {
      return NextResponse.json(
        { success: false, message: "Lead not found in this portfolio." },
        { status: 404 },
      );
    }

    const dateKey = getDateKey(scheduledAt, timezone);
    const { startDate, endDate } = getZonedDayRange(dateKey, timezone);
    const lockKey = portfolio.id;

    const booking = await prisma.$transaction(async (tx) => {
      // Serialize booking attempts and consultation configuration changes
      // for this portfolio using the same advisory lock.
      await tx.$queryRaw`
  SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
`;

      // Re-fetch the consultation type after acquiring the lock.
      // This prevents using a stale or deactivated type.
      const consultationType = await tx.consultationType.findFirst({
        where: {
          id: consultationTypeId,
          portfolioId: portfolio.id,
          active: true,
        },
        select: {
          id: true,
          title: true,
          durationMinutes: true,
          meetingMethod: true,
        },
      });

      if (!consultationType) {
        return { kind: "TYPE_UNAVAILABLE" as const };
      }

      // Availability is checked using the freshly fetched type and
      // the same transaction that will create the consultation.
      const availableSlots = await getAvailabilitySlots({
        portfolioId: portfolio.id,
        consultationTypeId: consultationType.id,
        startDate,
        endDate,
        client: tx,
      });

      const selectedSlot = availableSlots.find(
        (slot) => slot.start.getTime() === scheduledAt.getTime(),
      );

      if (!selectedSlot) {
        return { kind: "SLOT_UNAVAILABLE" as const };
      }

      const createdConsultation = await tx.consultation.create({
        data: {
          portfolioId: portfolio.id,
          leadId: lead.id,
          ownerId: portfolio.userId,
          consultationTypeId: consultationType.id,
          title,
          status: ConsultationStatus.PENDING,
          scheduledAt: selectedSlot.start,
          durationMinutes: consultationType.durationMinutes,
          timezone: selectedSlot.timezone,
          meetingMethod:
            meetingMethod ?? consultationType.meetingMethod ?? null,
          meetingUrl,
          meetingLocation,
          notes,
          activities: {
            create: {
              userId: user.id,
              title: "Consultation created",
              content: `Consultation scheduled for ${selectedSlot.start.toISOString()}.`,
              metadata: {
                source: "API",
                status: ConsultationStatus.PENDING,
              },
            },
          },
        },
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          consultationType: true,
        },
      });

      await recalculateLeadScore(tx, lead.id);

      return {
        kind: "BOOKED" as const,
        consultation: createdConsultation,
      };
    });

    if (booking.kind === "TYPE_UNAVAILABLE") {
      return NextResponse.json(
        {
          success: false,
          message: "Active consultation type not found in this portfolio.",
          code: "TYPE_UNAVAILABLE",
        },
        { status: 404 },
      );
    }

    if (booking.kind === "SLOT_UNAVAILABLE") {
      return NextResponse.json(
        {
          success: false,
          message:
            "That time is no longer available or conflicts with another consultation. Please choose another time.",
          code: "SLOT_UNAVAILABLE",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Consultation created successfully.",
        consultation: booking.consultation,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/consultation failed:", error);

    return NextResponse.json(
      { success: false, message: "Unable to create consultation." },
      { status: 500 },
    );
  }
}
