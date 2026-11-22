import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAvailabilitySlots, getZonedDayRange, isValidIanaTimezone } from "@/lib/consultations/availability";

function isValidDate(value: string) {
  const date = new Date(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
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
          timezone: true,
          timezoneReviewRequired: true,
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

    if (portfolio.timezoneReviewRequired || !isValidIanaTimezone(portfolio.timezone)) {
      return NextResponse.json({ success: false, message: "The portfolio owner must review the booking timezone before appointments can be requested." }, { status: 409 });
    }

    const { startDate, endDate } = getZonedDayRange(date, portfolio.timezone);

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
      timezone: portfolio.timezone,
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