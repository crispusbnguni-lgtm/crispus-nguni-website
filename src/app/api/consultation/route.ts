import { NextResponse } from "next/server";
import { ConsultationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getAvailabilitySlots } from "@/lib/consultations/availability";

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

function getUtcDayRange(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);

  return {
    startDate: new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
      ),
    ),
    endDate: new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    ),
  };
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
    const timezone = text(data.timezone, 100) ?? "Africa/Nairobi";
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

    if (
      !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*$/.test(timezone) ||
      timezone.length > 100
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid timezone." },
        { status: 400 },
      );
    }

    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    } catch {
      return NextResponse.json(
        { success: false, message: "Unsupported timezone." },
        { status: 400 },
      );
    }

    const portfolio = await prisma.portfolioSite.findUnique({
      where: { id: portfolioId },
      select: {
        id: true,
        userId: true,
        published: true,
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

    const [lead, consultationType] = await Promise.all([
      prisma.lead.findFirst({
        where: {
          id: leadId,
          portfolioId: portfolio.id,
        },
        select: { id: true },
      }),
      prisma.consultationType.findFirst({
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
      }),
    ]);

    if (!lead) {
      return NextResponse.json(
        { success: false, message: "Lead not found in this portfolio." },
        { status: 404 },
      );
    }

    if (!consultationType) {
      return NextResponse.json(
        {
          success: false,
          message: "Active consultation type not found in this portfolio.",
        },
        { status: 404 },
      );
    }

    const dateKey = getDateKey(scheduledAt, timezone);
    const { startDate, endDate } = getUtcDayRange(dateKey);
    const lockKey = portfolio.id;

    const consultation = await prisma.$transaction(async (tx) => {
      // Serialize booking attempts for this portfolio and calendar day.
      // The public booking endpoint uses this same lock key.
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
      `;

      // Availability must be checked after obtaining the lock.
      const availableSlots = await getAvailabilitySlots({
        portfolioId: portfolio.id,
        consultationTypeId: consultationType.id,
        startDate,
        endDate,
      });

      const selectedSlot = availableSlots.find(
        (slot) => slot.start.getTime() === scheduledAt.getTime(),
      );

      if (!selectedSlot) {
        return null;
      }

      return tx.consultation.create({
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
    });

    if (!consultation) {
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
        consultation,
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