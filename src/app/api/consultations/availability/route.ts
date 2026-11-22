
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSameOriginApiRequest } from "@/lib/authorization";

function getAdminUserId(request: Request) {
  const url = new URL(request.url);
  return url.searchParams.get("adminUserId")?.trim() || "";
}

async function getTargetPortfolio(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      portfolio: null,
      error: NextResponse.json(
        { success: false, message: "You must be logged in." },
        { status: 401 },
      ),
    };
  }

  const adminUserId = getAdminUserId(request);

  if (adminUserId && user.role !== "SUPER_ADMIN") {
    return {
      user,
      portfolio: null,
      error: NextResponse.json(
        {
          success: false,
          message:
            "You are not authorized to manage this user's availability.",
        },
        { status: 403 },
      ),
    };
  }

  const targetUserId = adminUserId || user.id;

  const portfolio = await prisma.portfolioSite.findUnique({
    where: { userId: targetUserId },
  });

  if (!portfolio) {
    return {
      user,
      portfolio: null,
      error: NextResponse.json(
        { success: false, message: "Portfolio not found." },
        { status: 404 },
      ),
    };
  }

  return { user, portfolio, error: null };
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isValidDayOfWeek(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

function normalizeDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    return null;
  }

  return parsed;
}

async function lockPortfolio(
  tx: Prisma.TransactionClient,
  portfolioId: string,
) {
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtext(${portfolioId}))
  `;
}

export async function GET(request: Request) {
  try {
    const { user, portfolio, error } =
      await getTargetPortfolio(request);

    if (error || !user || !portfolio) {
      return (
        error ||
        NextResponse.json(
          { success: false, message: "Unable to determine portfolio." },
          { status: 400 },
        )
      );
    }

    const [availabilityRules, availabilityExceptions] =
      await Promise.all([
        prisma.availabilityRule.findMany({
          where: { portfolioId: portfolio.id },
          orderBy: [
            { dayOfWeek: "asc" },
            { startTime: "asc" },
          ],
        }),
        prisma.availabilityException.findMany({
          where: { portfolioId: portfolio.id },
          orderBy: [
            { date: "asc" },
            { startTime: "asc" },
          ],
        }),
      ]);

    return NextResponse.json({
      success: true,
      timezone: portfolio.timezone,
      timezoneReviewRequired: portfolio.timezoneReviewRequired,
      availabilityRules: availabilityRules.map((rule) => ({
        ...rule,
        timezone: portfolio.timezone,
      })),
      availabilityExceptions,
    });
  } catch (error) {
    console.error("Availability GET error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load availability." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const originResponse = requireSameOriginApiRequest(request);
    if (originResponse) return originResponse;

    const { user, portfolio, error } =
      await getTargetPortfolio(request);

    if (error || !user || !portfolio) {
      return (
        error ||
        NextResponse.json(
          { success: false, message: "Unable to determine portfolio." },
          { status: 400 },
        )
      );
    }

    const body = await request.json();
    const action = String(body.action ?? "").trim();

    if (action === "rule") {
      const dayOfWeek = Number(body.dayOfWeek);
      const startTime = String(body.startTime ?? "").trim();
      const endTime = String(body.endTime ?? "").trim();
      const timezone = portfolio.timezone;

      const enabled =
        typeof body.enabled === "boolean" ? body.enabled : true;

      if (!isValidDayOfWeek(dayOfWeek)) {
        return NextResponse.json(
          {
            success: false,
            message: "Day of week must be between 0 and 6.",
          },
          { status: 400 },
        );
      }

      if (!isValidTime(startTime) || !isValidTime(endTime)) {
        return NextResponse.json(
          {
            success: false,
            message: "Start time and end time must use HH:MM format.",
          },
          { status: 400 },
        );
      }

      if (startTime >= endTime) {
        return NextResponse.json(
          {
            success: false,
            message: "End time must be later than start time.",
          },
          { status: 400 },
        );
      }

      const availabilityRule = await prisma.$transaction(
        async (tx) => {
          await lockPortfolio(tx, portfolio.id);

          return tx.availabilityRule.create({
            data: {
              portfolioId: portfolio.id,
              dayOfWeek,
              startTime,
              endTime,
              timezone,
              enabled,
            },
          });
        },
        { maxWait: 10000, timeout: 15000 },
      );

      return NextResponse.json(
        {
          success: true,
          message: "Availability rule created successfully.",
          availabilityRule,
        },
        { status: 201 },
      );
    }

    if (action === "exception") {
      const dateValue = String(body.date ?? "").trim();
      const date = normalizeDate(dateValue);

      if (!date) {
        return NextResponse.json(
          { success: false, message: "A valid date is required." },
          { status: 400 },
        );
      }

      const type = String(body.type ?? "").trim();

      if (type !== "UNAVAILABLE" && type !== "CUSTOM_HOURS") {
        return NextResponse.json(
          {
            success: false,
            message:
              "Exception type must be UNAVAILABLE or CUSTOM_HOURS.",
          },
          { status: 400 },
        );
      }

      const startTime =
        body.startTime !== undefined && body.startTime !== null
          ? String(body.startTime).trim()
          : null;

      const endTime =
        body.endTime !== undefined && body.endTime !== null
          ? String(body.endTime).trim()
          : null;

      const reason = String(body.reason ?? "").trim() || null;

      if (type === "CUSTOM_HOURS") {
        if (
          !startTime ||
          !endTime ||
          !isValidTime(startTime) ||
          !isValidTime(endTime)
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Custom hours require valid start and end times.",
            },
            { status: 400 },
          );
        }

        if (startTime >= endTime) {
          return NextResponse.json(
            {
              success: false,
              message: "End time must be later than start time.",
            },
            { status: 400 },
          );
        }
      }

      const result = await prisma.$transaction(
        async (tx) => {
          await lockPortfolio(tx, portfolio.id);

          const duplicate =
            await tx.availabilityException.findFirst({
              where: {
                portfolioId: portfolio.id,
                date,
              },
              select: { id: true },
            });

          if (duplicate) {
            return { kind: "DUPLICATE" as const };
          }

          const availabilityException =
            await tx.availabilityException.create({
              data: {
                portfolioId: portfolio.id,
                date,
                type,
                startTime:
                  type === "CUSTOM_HOURS" ? startTime : null,
                endTime:
                  type === "CUSTOM_HOURS" ? endTime : null,
                reason,
              },
            });

          return {
            kind: "CREATED" as const,
            availabilityException,
          };
        },
        { maxWait: 10000, timeout: 15000 },
      );

      if (result.kind === "DUPLICATE") {
        return NextResponse.json(
          {
            success: false,
            message:
              "An availability exception already exists for this date. Update the existing exception instead.",
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          success: true,
          message: "Availability exception created successfully.",
          availabilityException: result.availabilityException,
        },
        { status: 201 },
      );
    }

    return NextResponse.json(
      { success: false, message: "Invalid availability action." },
      { status: 400 },
    );
  } catch (error) {
    console.error("Availability POST error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to create availability." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const originResponse = requireSameOriginApiRequest(request);
    if (originResponse) return originResponse;

    const { user, portfolio, error } =
      await getTargetPortfolio(request);

    if (error || !user || !portfolio) {
      return (
        error ||
        NextResponse.json(
          { success: false, message: "Unable to determine portfolio." },
          { status: 400 },
        )
      );
    }

    const body = await request.json();
    const resource = String(body.resource ?? "").trim();
    const id = String(body.id ?? "").trim();

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Availability ID is required." },
        { status: 400 },
      );
    }

    if (resource === "rule") {
      const data: {
        dayOfWeek?: number;
        startTime?: string;
        endTime?: string;
        timezone: string;
        enabled?: boolean;
      } = { timezone: portfolio.timezone };

      if (body.dayOfWeek !== undefined) {
        const dayOfWeek = Number(body.dayOfWeek);

        if (!isValidDayOfWeek(dayOfWeek)) {
          return NextResponse.json(
            {
              success: false,
              message: "Day of week must be between 0 and 6.",
            },
            { status: 400 },
          );
        }

        data.dayOfWeek = dayOfWeek;
      }

      if (body.startTime !== undefined) {
        const startTime = String(body.startTime).trim();

        if (!isValidTime(startTime)) {
          return NextResponse.json(
            {
              success: false,
              message: "Start time must use HH:MM format.",
            },
            { status: 400 },
          );
        }

        data.startTime = startTime;
      }

      if (body.endTime !== undefined) {
        const endTime = String(body.endTime).trim();

        if (!isValidTime(endTime)) {
          return NextResponse.json(
            {
              success: false,
              message: "End time must use HH:MM format.",
            },
            { status: 400 },
          );
        }

        data.endTime = endTime;
      }

      if (typeof body.enabled === "boolean") {
        data.enabled = body.enabled;
      }

      const result = await prisma.$transaction(
        async (tx) => {
          await lockPortfolio(tx, portfolio.id);

          const existing = await tx.availabilityRule.findFirst({
            where: {
              id,
              portfolioId: portfolio.id,
            },
          });

          if (!existing) {
            return { kind: "NOT_FOUND" as const };
          }

          const finalStartTime =
            data.startTime ?? existing.startTime;
          const finalEndTime =
            data.endTime ?? existing.endTime;

          if (finalStartTime >= finalEndTime) {
            return { kind: "INVALID_TIME" as const };
          }

          const availabilityRule =
            await tx.availabilityRule.update({
              where: { id: existing.id },
              data,
            });

          return {
            kind: "UPDATED" as const,
            availabilityRule,
          };
        },
        { maxWait: 10000, timeout: 15000 },
      );

      if (result.kind === "NOT_FOUND") {
        return NextResponse.json(
          { success: false, message: "Availability rule not found." },
          { status: 404 },
        );
      }

      if (result.kind === "INVALID_TIME") {
        return NextResponse.json(
          {
            success: false,
            message: "End time must be later than start time.",
          },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        message: "Availability rule updated successfully.",
        availabilityRule: result.availabilityRule,
      });
    }

    if (resource === "exception") {
      const existing =
        await prisma.availabilityException.findFirst({
          where: { id, portfolioId: portfolio.id },
        });

      if (!existing) {
        return NextResponse.json(
          {
            success: false,
            message: "Availability exception not found.",
          },
          { status: 404 },
        );
      }

      const data: {
        date?: Date;
        type?: "UNAVAILABLE" | "CUSTOM_HOURS";
        startTime?: string | null;
        endTime?: string | null;
        reason?: string | null;
      } = {};

      if (body.date !== undefined) {
        const date = normalizeDate(String(body.date).trim());

        if (!date) {
          return NextResponse.json(
            { success: false, message: "A valid date is required." },
            { status: 400 },
          );
        }

        data.date = date;
      }

      if (body.type !== undefined) {
        const type = String(body.type).trim();

        if (type !== "UNAVAILABLE" && type !== "CUSTOM_HOURS") {
          return NextResponse.json(
            {
              success: false,
              message:
                "Exception type must be UNAVAILABLE or CUSTOM_HOURS.",
            },
            { status: 400 },
          );
        }

        data.type = type;
      }

      if (body.startTime !== undefined) {
        data.startTime =
          body.startTime === null
            ? null
            : String(body.startTime).trim();
      }

      if (body.endTime !== undefined) {
        data.endTime =
          body.endTime === null
            ? null
            : String(body.endTime).trim();
      }

      if (body.reason !== undefined) {
        data.reason = String(body.reason).trim() || null;
      }

      const result = await prisma.$transaction(
        async (tx) => {
          await lockPortfolio(tx, portfolio.id);

          const current =
            await tx.availabilityException.findFirst({
              where: {
                id: existing.id,
                portfolioId: portfolio.id,
              },
            });

          if (!current) {
            return { kind: "NOT_FOUND" as const };
          }

          const finalDate = data.date ?? current.date;
          const finalType = data.type ?? current.type;

          const finalStartTime =
            data.startTime !== undefined
              ? data.startTime
              : current.startTime;

          const finalEndTime =
            data.endTime !== undefined
              ? data.endTime
              : current.endTime;

          if (finalType === "CUSTOM_HOURS") {
            if (
              !finalStartTime ||
              !finalEndTime ||
              !isValidTime(finalStartTime) ||
              !isValidTime(finalEndTime)
            ) {
              return { kind: "INVALID_HOURS" as const };
            }

            if (finalStartTime >= finalEndTime) {
              return { kind: "INVALID_HOURS" as const };
            }
          } else {
            data.startTime = null;
            data.endTime = null;
          }

          const duplicate =
            await tx.availabilityException.findFirst({
              where: {
                portfolioId: portfolio.id,
                date: finalDate,
                id: { not: current.id },
              },
              select: { id: true },
            });

          if (duplicate) {
            return { kind: "DUPLICATE" as const };
          }

          const availabilityException =
            await tx.availabilityException.update({
              where: { id: current.id },
              data,
            });

          return {
            kind: "UPDATED" as const,
            availabilityException,
          };
        },
        { maxWait: 10000, timeout: 15000 },
      );

      if (result.kind === "NOT_FOUND") {
        return NextResponse.json(
          {
            success: false,
            message: "Availability exception not found.",
          },
          { status: 404 },
        );
      }

      if (result.kind === "DUPLICATE") {
        return NextResponse.json(
          {
            success: false,
            message:
              "Another availability exception already exists for this date.",
          },
          { status: 409 },
        );
      }

      if (result.kind === "INVALID_HOURS") {
        return NextResponse.json(
          {
            success: false,
            message:
              "Custom hours require valid start and end times, with the end later than the start.",
          },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        message: "Availability exception updated successfully.",
        availabilityException: result.availabilityException,
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: "Resource must be rule or exception.",
      },
      { status: 400 },
    );
  } catch (error) {
    console.error("Availability PUT error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to update availability." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const originResponse = requireSameOriginApiRequest(request);
    if (originResponse) return originResponse;

    const { user, portfolio, error } =
      await getTargetPortfolio(request);

    if (error || !user || !portfolio) {
      return (
        error ||
        NextResponse.json(
          { success: false, message: "Unable to determine portfolio." },
          { status: 400 },
        )
      );
    }

    const url = new URL(request.url);
    const resource = url.searchParams.get("resource")?.trim() || "";
    const id = url.searchParams.get("id")?.trim() || "";

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Availability ID is required." },
        { status: 400 },
      );
    }

    if (resource === "rule") {
      const result = await prisma.$transaction(
        async (tx) => {
          await lockPortfolio(tx, portfolio.id);

          const existing = await tx.availabilityRule.findFirst({
            where: {
              id,
              portfolioId: portfolio.id,
            },
            select: { id: true },
          });

          if (!existing) {
            return { kind: "NOT_FOUND" as const };
          }

          await tx.availabilityRule.delete({
            where: { id: existing.id },
          });

          return { kind: "DELETED" as const };
        },
        { maxWait: 10000, timeout: 15000 },
      );

      if (result.kind === "NOT_FOUND") {
        return NextResponse.json(
          { success: false, message: "Availability rule not found." },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        message: "Availability rule deleted successfully.",
      });
    }

    if (resource === "exception") {
      const result = await prisma.$transaction(
        async (tx) => {
          await lockPortfolio(tx, portfolio.id);

          const existing =
            await tx.availabilityException.findFirst({
              where: {
                id,
                portfolioId: portfolio.id,
              },
            });

          if (!existing) {
            return { kind: "NOT_FOUND" as const };
          }

          await tx.availabilityException.delete({
            where: { id: existing.id },
          });

          return { kind: "DELETED" as const };
        },
        { maxWait: 10000, timeout: 15000 },
      );

      if (result.kind === "NOT_FOUND") {
        return NextResponse.json(
          {
            success: false,
            message: "Availability exception not found.",
          },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        message: "Availability exception deleted successfully.",
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: "Resource must be rule or exception.",
      },
      { status: 400 },
    );
  } catch (error) {
    console.error("Availability DELETE error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to delete availability." },
      { status: 500 },
    );
  }
}
