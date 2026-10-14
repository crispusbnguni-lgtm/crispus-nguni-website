import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAvailabilitySlots } from "@/lib/consultations/availability";

function isValidDate(value: string) {
  const date = new Date(value);

  return (
    !Number.isNaN(date.getTime()) &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  );
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
  );
}

function endOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const portfolioId =
      url.searchParams.get("portfolioId")?.trim() ||
      "";

    const consultationTypeId =
      url.searchParams
        .get("consultationTypeId")
        ?.trim() || "";

    const date =
      url.searchParams.get("date")?.trim() || "";

    if (!portfolioId) {
      return NextResponse.json(
        {
          success: false,
          message: "Portfolio ID is required.",
        },
        { status: 400 },
      );
    }

    if (!consultationTypeId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Consultation type ID is required.",
        },
        { status: 400 },
      );
    }

    if (!date) {
      return NextResponse.json(
        {
          success: false,
          message: "Date is required.",
        },
        { status: 400 },
      );
    }

    if (!isValidDate(date)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Date must use YYYY-MM-DD format.",
        },
        { status: 400 },
      );
    }

    const portfolio =
      await prisma.portfolioSite.findUnique({
        where: {
          id: portfolioId,
        },
        select: {
          id: true,
          published: true,
        },
      });

    if (!portfolio) {
      return NextResponse.json(
        {
          success: false,
          message: "Portfolio not found.",
        },
        { status: 404 },
      );
    }

    if (!portfolio.published) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This portfolio is not available for public booking.",
        },
        { status: 404 },
      );
    }

    const consultationType =
      await prisma.consultationType.findFirst({
        where: {
          id: consultationTypeId,
          portfolioId: portfolio.id,
          active: true,
        },
        select: {
          id: true,
          title: true,
          durationMinutes: true,
          bufferBeforeMinutes: true,
          bufferAfterMinutes: true,
          minimumNoticeMinutes: true,
          maximumAdvanceDays: true,
          meetingMethod: true,
        },
      });

    if (!consultationType) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Consultation type not found.",
        },
        { status: 404 },
      );
    }

    const requestedDate = new Date(
      `${date}T00:00:00.000Z`,
    );

    const startDate =
      startOfUtcDay(requestedDate);

    const endDate =
      endOfUtcDay(requestedDate);

    const slots =
      await getAvailabilitySlots({
        portfolioId: portfolio.id,
        consultationTypeId:
          consultationType.id,
        startDate,
        endDate,
      });

    return NextResponse.json({
      success: true,
      date,
      consultationType,
      slots: slots.map((slot) => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        timezone: slot.timezone,
      })),
    });
  } catch (error) {
    console.error(
      "Availability slots GET error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to calculate available consultation slots.",
      },
      { status: 500 },
    );
  }
}