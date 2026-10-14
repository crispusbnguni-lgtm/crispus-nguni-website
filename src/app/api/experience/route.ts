import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
        {
          success: false,
          message: "You must be logged in.",
        },
        { status: 401 }
      ),
    };
  }

  const adminUserId = getAdminUserId(request);

  /*
   * Only SUPER_ADMIN can manage another user's portfolio.
   */
  if (adminUserId && user.role !== "SUPER_ADMIN") {
    return {
      user,
      portfolio: null,
      error: NextResponse.json(
        {
          success: false,
          message: "You are not authorized to manage this portfolio.",
        },
        { status: 403 }
      ),
    };
  }

  const targetUserId = adminUserId || user.id;

  const portfolio = await prisma.portfolioSite.findUnique({
    where: {
      userId: targetUserId,
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!portfolio) {
    return {
      user,
      portfolio: null,
      error: NextResponse.json(
        {
          success: false,
          message: "Portfolio not found.",
        },
        { status: 404 }
      ),
    };
  }

  return {
    user,
    portfolio,
    error: null,
  };
}

export async function GET(request: Request) {
  try {
    const { portfolio, error } = await getTargetPortfolio(request);

    if (error || !portfolio) {
      return (
        error ||
        NextResponse.json(
          {
            success: false,
            message: "Unable to determine portfolio.",
          },
          { status: 400 }
        )
      );
    }

    const experiences = await prisma.experience.findMany({
      where: {
        portfolioId: portfolio.id,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      experiences,
    });
  } catch (error) {
    console.error("Experience GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load experience.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { portfolio, error } = await getTargetPortfolio(request);

    if (error || !portfolio) {
      return (
        error ||
        NextResponse.json(
          {
            success: false,
            message: "Unable to determine portfolio.",
          },
          { status: 400 }
        )
      );
    }

    const body = await request.json();

    const jobTitle = String(body.jobTitle ?? "").trim();
    const company = String(body.company ?? "").trim();
    const employmentType = String(body.employmentType ?? "").trim();
    const location = String(body.location ?? "").trim();
    const startDate = String(body.startDate ?? "").trim();
    const endDate = String(body.endDate ?? "").trim();
    const description = String(body.description ?? "").trim();
    const current = Boolean(body.current);

    if (!jobTitle || !company || !startDate) {
      return NextResponse.json(
        {
          success: false,
          message: "Job title, company and start date are required.",
        },
        { status: 400 }
      );
    }

    const parsedStartDate = new Date(startDate);

    if (Number.isNaN(parsedStartDate.getTime())) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide a valid start date.",
        },
        { status: 400 }
      );
    }

    let parsedEndDate: Date | null = null;

    if (!current && endDate) {
      parsedEndDate = new Date(endDate);

      if (Number.isNaN(parsedEndDate.getTime())) {
        return NextResponse.json(
          {
            success: false,
            message: "Please provide a valid end date.",
          },
          { status: 400 }
        );
      }

      if (parsedEndDate < parsedStartDate) {
        return NextResponse.json(
          {
            success: false,
          message: "End date cannot be before the start date.",
          },
        { status: 400 }
        );
      }
    }

    const lastExperience = await prisma.experience.findFirst({
      where: {
        portfolioId: portfolio.id,
      },
      orderBy: {
        sortOrder: "desc",
      },
    });

    const experience = await prisma.experience.create({
      data: {
        portfolioId: portfolio.id,
        jobTitle,
        company,
        employmentType: employmentType || null,
        location: location || null,
        startDate: parsedStartDate,
        endDate: current ? null : parsedEndDate,
        current,
        description: description || null,
        sortOrder: (lastExperience?.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Experience added successfully.",
        experience,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Experience POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to add experience.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { portfolio, error } = await getTargetPortfolio(request);

    if (error || !portfolio) {
      return (
        error ||
        NextResponse.json(
          {
            success: false,
            message: "Unable to determine portfolio.",
          },
          { status: 400 }
        )
      );
    }

    const body = await request.json();

    const id = String(body.id ?? "").trim();
    const jobTitle = String(body.jobTitle ?? "").trim();
    const company = String(body.company ?? "").trim();
    const employmentType = String(body.employmentType ?? "").trim();
    const location = String(body.location ?? "").trim();
    const startDate = String(body.startDate ?? "").trim();
    const endDate = String(body.endDate ?? "").trim();
    const description = String(body.description ?? "").trim();
    const current = Boolean(body.current);

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Experience ID is required.",
        },
        { status: 400 }
      );
    }

    if (!jobTitle || !company || !startDate) {
      return NextResponse.json(
        {
          success: false,
          message: "Job title, company and start date are required.",
        },
        { status: 400 }
      );
    }

    const existingExperience = await prisma.experience.findFirst({
      where: {
        id,
        portfolioId: portfolio.id,
      },
    });

    if (!existingExperience) {
      return NextResponse.json(
        {
          success: false,
          message: "Experience not found.",
        },
        { status: 404 }
      );
    }

    const parsedStartDate = new Date(startDate);

    if (Number.isNaN(parsedStartDate.getTime())) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide a valid start date.",
        },
        { status: 400 }
      );
    }

    let parsedEndDate: Date | null = null;

    if (!current && endDate) {
      parsedEndDate = new Date(endDate);

      if (Number.isNaN(parsedEndDate.getTime())) {
        return NextResponse.json(
          {
            success: false,
            message: "Please provide a valid end date.",
          },
          { status: 400 }
        );
      }

      if (parsedEndDate < parsedStartDate) {
        return NextResponse.json(
          {
            success: false,
            message: "End date cannot be before the start date.",
          },
          { status: 400 }
        );
      }
    }

    const experience = await prisma.experience.update({
      where: {
        id: existingExperience.id,
      },
      data: {
        jobTitle,
        company,
        employmentType: employmentType || null,
        location: location || null,
        startDate: parsedStartDate,
        endDate: current ? null : parsedEndDate,
        current,
        description: description || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Experience updated successfully.",
      experience,
    });
  } catch (error) {
    console.error("Experience PUT error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update experience.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { portfolio, error } = await getTargetPortfolio(request);

    if (error || !portfolio) {
      return (
        error ||
        NextResponse.json(
          {
            success: false,
            message: "Unable to determine portfolio.",
          },
          { status: 400 }
        )
      );
    }

    const body = await request.json();

    const id = String(body.id ?? "").trim();
    const direction = String(body.direction ?? "").trim();

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Experience ID is required.",
        },
        { status: 400 }
      );
    }

    if (direction !== "up" && direction !== "down") {
      return NextResponse.json(
        {
          success: false,
          message: "A valid reorder direction is required.",
        },
        { status: 400 }
      );
    }

    const currentExperience = await prisma.experience.findFirst({
      where: {
        id,
        portfolioId: portfolio.id,
      },
    });

    if (!currentExperience) {
      return NextResponse.json(
        {
          success: false,
          message: "Experience not found.",
        },
        { status: 404 }
      );
    }

    const neighboringExperience = await prisma.experience.findFirst({
      where: {
        portfolioId: portfolio.id,
        ...(direction === "up"
          ? {
              sortOrder: {
                lt: currentExperience.sortOrder,
              },
            }
          : {
              sortOrder: {
                gt: currentExperience.sortOrder,
              },
            }),
      },
      orderBy: {
        sortOrder: direction === "up" ? "desc" : "asc",
      },
    });

    if (!neighboringExperience) {
      return NextResponse.json({
        success: true,
        message:
          direction === "up"
            ? "Experience is already first."
            : "Experience is already last.",
      });
    }

    await prisma.$transaction([
      prisma.experience.update({
        where: {
          id: currentExperience.id,
        },
        data: {
          sortOrder: neighboringExperience.sortOrder,
        },
      }),
      prisma.experience.update({
        where: {
          id: neighboringExperience.id,
        },
        data: {
          sortOrder: currentExperience.sortOrder,
        },
      }),
    ]);

    const experiences = await prisma.experience.findMany({
      where: {
        portfolioId: portfolio.id,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Experience order updated successfully.",
      experiences,
    });
  } catch (error) {
    console.error("Experience PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to reorder experience.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { portfolio, error } = await getTargetPortfolio(request);

    if (error || !portfolio) {
      return (
        error ||
        NextResponse.json(
          {
            success: false,
            message: "Unable to determine portfolio.",
          },
          { status: 400 }
        )
      );
    }

    const body = await request.json();
    const id = String(body.id ?? "").trim();

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Experience ID is required.",
        },
        { status: 400 }
      );
    }

    const experience = await prisma.experience.findFirst({
      where: {
        id,
        portfolioId: portfolio.id,
      },
    });

    if (!experience) {
      return NextResponse.json(
        {
          success: false,
          message: "Experience not found.",
        },
        { status: 404 }
      );
    }

    await prisma.experience.delete({
      where: {
        id: experience.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Experience deleted successfully.",
    });
  } catch (error) {
    console.error("Experience DELETE error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to delete experience.",
      },
      { status: 500 }
    );
  }
}