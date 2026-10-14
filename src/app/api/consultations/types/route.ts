import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ConsultationTypePayload = {
  title?: unknown;
  description?: unknown;
  durationMinutes?: unknown;
  bufferBeforeMinutes?: unknown;
  bufferAfterMinutes?: unknown;
  minimumNoticeMinutes?: unknown;
  maximumAdvanceDays?: unknown;
  meetingMethod?: unknown;
  active?: unknown;
  featured?: unknown;
  sortOrder?: unknown;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status },
  );
}

function parseOptionalString(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

function parseInteger(
  value: unknown,
  fieldName: string,
  minimum: number,
) {
  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < minimum
  ) {
    throw new Error(
      `${fieldName} must be a whole number of at least ${minimum}.`,
    );
  }

  return parsed;
}

function parseBoolean(
  value: unknown,
  fieldName: string,
) {
  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} must be true or false.`);
  }

  return value;
}


async function getPortfolioForRequest(
  request: Request,
) {
  const user = await getCurrentUser();

  if (!user) {
    return {
      error: jsonError("Unauthorized", 401),
      user: null,
      portfolio: null,
    };
  }

  const url = new URL(request.url);

  const adminUserId =
    url.searchParams
      .get("adminUserId")
      ?.trim() || "";

  if (adminUserId) {
    if (user.role !== "SUPER_ADMIN") {
      return {
        error: jsonError(
          "Only a SUPER_ADMIN can manage another user's consultation types.",
          403,
        ),
        user,
        portfolio: null,
      };
    }

    const targetUser =
      await prisma.user.findUnique({
        where: {
          id: adminUserId,
        },
        include: {
          portfolioSite: true,
        },
      });

    if (!targetUser) {
      return {
        error: jsonError(
          "Target user not found.",
          404,
        ),
        user,
        portfolio: null,
      };
    }

    if (!targetUser.portfolioSite) {
      return {
        error: jsonError(
          "Target user does not have a portfolio.",
          404,
        ),
        user,
        portfolio: null,
      };
    }

    return {
      error: null,
      user,
      portfolio: targetUser.portfolioSite,
    };
  }

  if (!user.portfolioSite) {
    return {
      error: jsonError(
        "Portfolio not found.",
        404,
      ),
      user,
      portfolio: null,
    };
  }

  return {
    error: null,
    user,
    portfolio: user.portfolioSite,
  };
}

export async function GET(request: Request) {
  try {
    const {
      error,
      portfolio,
    } = await getPortfolioForRequest(request);

    if (error) {
      return error;
    }

    const consultationTypes =
      await prisma.consultationType.findMany({
        where: {
          portfolioId: portfolio!.id,
        },
        orderBy: [
          {
            sortOrder: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      });

    return NextResponse.json({
      success: true,
      consultationTypes,
    });
  } catch (error) {
    console.error(
      "Failed to fetch consultation types:",
      error,
    );

    return jsonError(
      "Failed to fetch consultation types.",
      500,
    );
  }
}

export async function POST(request: Request) {
  try {
    const {
      error,
      portfolio,
    } = await getPortfolioForRequest(request);

    if (error) {
      return error;
    }

    const body =
      (await request.json()) as ConsultationTypePayload;

    const title =
      typeof body.title === "string"
        ? body.title.trim()
        : "";

    if (!title) {
      return jsonError(
        "Consultation title is required.",
      );
    }

    if (title.length > 150) {
      return jsonError(
        "Consultation title must be 150 characters or fewer.",
      );
    }

    const description =
      parseOptionalString(body.description);

    const durationMinutes =
      parseInteger(
        body.durationMinutes ?? 30,
        "Duration",
        1,
      );

    const bufferBeforeMinutes =
      parseInteger(
        body.bufferBeforeMinutes ?? 0,
        "Buffer before",
        0,
      );

    const bufferAfterMinutes =
      parseInteger(
        body.bufferAfterMinutes ?? 15,
        "Buffer after",
        0,
      );

    const minimumNoticeMinutes =
      parseInteger(
        body.minimumNoticeMinutes ?? 120,
        "Minimum notice",
        0,
      );

    const maximumAdvanceDays =
      parseInteger(
        body.maximumAdvanceDays ?? 60,
        "Maximum advance",
        1,
      );

    const meetingMethod =
      parseOptionalString(body.meetingMethod);

    const active =
      body.active === undefined
        ? true
        : parseBoolean(
            body.active,
            "Active",
          );

    const featured =
      body.featured === undefined
        ? false
        : parseBoolean(
            body.featured,
            "Featured",
          );

    const sortOrder =
      parseInteger(
        body.sortOrder ?? 0,
        "Sort order",
        0,
      );

    const consultationType =
      await prisma.consultationType.create({
        data: {
          portfolioId: portfolio!.id,
          title,
          description,
          durationMinutes,
          bufferBeforeMinutes,
          bufferAfterMinutes,
          minimumNoticeMinutes,
          maximumAdvanceDays,
          meetingMethod,
          active,
          featured,
          sortOrder,
        },
      });

    return NextResponse.json(
      {
        success: true,
        consultationType,
        message:
          "Consultation type created successfully.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "Failed to create consultation type:",
      error,
    );

    if (
      error instanceof Error &&
      !error.message.includes(
        "Prisma",
      )
    ) {
      return jsonError(
        error.message,
        400,
      );
    }

    return jsonError(
      "Failed to create consultation type.",
      500,
    );
  }
}

export async function PUT(request: Request) {
  try {
    const {
      error,
      portfolio,
    } = await getPortfolioForRequest(request);

    if (error) {
      return error;
    }

    const body =
      (await request.json()) as ConsultationTypePayload & {
        id?: unknown;
      };

    const id =
      typeof body.id === "string"
        ? body.id.trim()
        : "";

    if (!id) {
      return jsonError(
        "Consultation type ID is required.",
      );
    }

    const existing =
      await prisma.consultationType.findFirst({
        where: {
          id,
          portfolioId: portfolio!.id,
        },
      });

    if (!existing) {
      return jsonError(
        "Consultation type not found.",
        404,
      );
    }

    const data: {
      title?: string;
      description?: string | null;
      durationMinutes?: number;
      bufferBeforeMinutes?: number;
      bufferAfterMinutes?: number;
      minimumNoticeMinutes?: number;
      maximumAdvanceDays?: number;
      meetingMethod?: string | null;
      active?: boolean;
      featured?: boolean;
      sortOrder?: number;
    } = {};

    if (body.title !== undefined) {
      if (
        typeof body.title !== "string" ||
        !body.title.trim()
      ) {
        return jsonError(
          "Consultation title is required.",
        );
      }

      data.title = body.title.trim();
    }

    if (body.description !== undefined) {
      data.description =
        parseOptionalString(
          body.description,
        );
    }

    if (body.durationMinutes !== undefined) {
      data.durationMinutes =
        parseInteger(
          body.durationMinutes,
          "Duration",
          1,
        );
    }

    if (
      body.bufferBeforeMinutes !==
      undefined
    ) {
      data.bufferBeforeMinutes =
        parseInteger(
          body.bufferBeforeMinutes,
          "Buffer before",
          0,
        );
    }

    if (
      body.bufferAfterMinutes !==
      undefined
    ) {
      data.bufferAfterMinutes =
        parseInteger(
          body.bufferAfterMinutes,
          "Buffer after",
          0,
        );
    }

    if (
      body.minimumNoticeMinutes !==
      undefined
    ) {
      data.minimumNoticeMinutes =
        parseInteger(
          body.minimumNoticeMinutes,
          "Minimum notice",
          0,
        );
    }

    if (
      body.maximumAdvanceDays !==
      undefined
    ) {
      data.maximumAdvanceDays =
        parseInteger(
          body.maximumAdvanceDays,
          "Maximum advance",
          1,
        );
    }

    if (body.meetingMethod !== undefined) {
      data.meetingMethod =
        parseOptionalString(
          body.meetingMethod,
        );
    }

    if (body.active !== undefined) {
      data.active =
        parseBoolean(
          body.active,
          "Active",
        );
    }

    if (body.featured !== undefined) {
      data.featured =
        parseBoolean(
          body.featured,
          "Featured",
        );
    }

    if (body.sortOrder !== undefined) {
      data.sortOrder =
        parseInteger(
          body.sortOrder,
          "Sort order",
          0,
        );
    }

    const consultationType =
      await prisma.consultationType.update({
        where: {
          id: existing.id,
        },
        data,
      });

    return NextResponse.json({
      success: true,
      consultationType,
      message:
        "Consultation type updated successfully.",
    });
  } catch (error) {
    console.error(
      "Failed to update consultation type:",
      error,
    );

    if (
      error instanceof Error &&
      !error.message.includes(
        "Prisma",
      )
    ) {
      return jsonError(
        error.message,
        400,
      );
    }

    return jsonError(
      "Failed to update consultation type.",
      500,
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const {
      error,
      portfolio,
    } = await getPortfolioForRequest(request);

    if (error) {
      return error;
    }

    const url = new URL(request.url);

    const id =
      url.searchParams
        .get("id")
        ?.trim() || "";

    if (!id) {
      return jsonError(
        "Consultation type ID is required.",
      );
    }

    const existing =
      await prisma.consultationType.findFirst({
        where: {
          id,
          portfolioId: portfolio!.id,
        },
      });

    if (!existing) {
      return jsonError(
        "Consultation type not found.",
        404,
      );
    }

    const bookingCount =
      await prisma.consultation.count({
        where: {
          consultationTypeId: existing.id,
        },
      });

    if (bookingCount > 0) {
      return jsonError(
        "This consultation type cannot be deleted because it has booking history. Deactivate it instead.",
        409,
      );
    }

    await prisma.consultationType.delete({
      where: {
        id: existing.id,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Consultation type deleted successfully.",
    });
  } catch (error) {
    console.error(
      "Failed to delete consultation type:",
      error,
    );

    return jsonError(
      "Failed to delete consultation type.",
      500,
    );
  }
}