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

    const education = await prisma.education.findMany({
      where: {
        portfolioId: portfolio.id,
      },
      orderBy: [
        {
          sortOrder: "asc",
        },
        {
          startDate: "desc",
        },
      ],
    });

    return NextResponse.json({
      success: true,
      education,
    });
  } catch (error) {
    console.error("Education GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load education.",
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

    const institution = String(body.institution ?? "").trim();
    const degree = String(body.degree ?? "").trim();
    const field = String(body.field ?? "").trim();
    const location = String(body.location ?? "").trim();
    const description = String(body.description ?? "").trim();
    const startDateValue = String(body.startDate ?? "").trim();
    const endDateValue = String(body.endDate ?? "").trim();
    const current = Boolean(body.current);

    if (!institution || !degree || !startDateValue) {
      return NextResponse.json(
        {
          success: false,
          message: "Institution, degree and start date are required.",
        },
        { status: 400 }
      );
    }

    const startDate = new Date(startDateValue);

    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide a valid start date.",
        },
        { status: 400 }
      );
    }

    let endDate: Date | null = null;

    if (!current && endDateValue) {
      endDate = new Date(endDateValue);

      if (Number.isNaN(endDate.getTime())) {
        return NextResponse.json(
          {
            success: false,
            message: "Please provide a valid end date.",
          },
          { status: 400 }
        );
      }

      if (endDate < startDate) {
        return NextResponse.json(
          {
            success: false,
            message: "End date cannot be before the start date.",
          },
          { status: 400 }
        );
      }
    }

    const educationCount = await prisma.education.count({
      where: {
        portfolioId: portfolio.id,
      },
    });

    const education = await prisma.education.create({
      data: {
        portfolioId: portfolio.id,
        institution,
        degree,
        field: field || null,
        location: location || null,
        startDate,
        endDate: current ? null : endDate,
        current,
        description: description || null,
        sortOrder: educationCount,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Education added successfully.",
        education,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Education POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to add education.",
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
    const institution = String(body.institution ?? "").trim();
    const degree = String(body.degree ?? "").trim();
    const field = String(body.field ?? "").trim();
    const location = String(body.location ?? "").trim();
    const description = String(body.description ?? "").trim();
    const startDateValue = String(body.startDate ?? "").trim();
    const endDateValue = String(body.endDate ?? "").trim();
    const current = Boolean(body.current);

    if (!id || !institution || !degree || !startDateValue) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Education ID, institution, degree and start date are required.",
        },
        { status: 400 }
      );
    }

    const existingEducation = await prisma.education.findFirst({
      where: {
        id,
        portfolioId: portfolio.id,
      },
    });

    if (!existingEducation) {
      return NextResponse.json(
        {
          success: false,
          message: "Education record not found.",
        },
        { status: 404 }
      );
    }

    const startDate = new Date(startDateValue);

    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide a valid start date.",
        },
        { status: 400 }
      );
    }

    let endDate: Date | null = null;

    if (!current && endDateValue) {
      endDate = new Date(endDateValue);

      if (Number.isNaN(endDate.getTime())) {
        return NextResponse.json(
          {
            success: false,
            message: "Please provide a valid end date.",
          },
          { status: 400 }
        );
      }

      if (endDate < startDate) {
        return NextResponse.json(
          {
            success: false,
            message: "End date cannot be before the start date.",
          },
          { status: 400 }
        );
      }
    }

    const education = await prisma.education.update({
      where: {
        id: existingEducation.id,
      },
      data: {
        institution,
        degree,
        field: field || null,
        location: location || null,
        startDate,
        endDate: current ? null : endDate,
        current,
        description: description || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Education updated successfully.",
      education,
    });
  } catch (error) {
    console.error("Education PUT error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update education.",
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

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Education ID is required.",
        },
        { status: 400 }
      );
    }

    const existingEducation = await prisma.education.findFirst({
      where: {
        id,
        portfolioId: portfolio.id,
      },
    });

    if (!existingEducation) {
      return NextResponse.json(
        {
          success: false,
          message: "Education record not found.",
        },
        { status: 404 }
      );
    }

    if (typeof body.current === "boolean") {
      const education = await prisma.education.update({
        where: {
          id: existingEducation.id,
        },
        data: {
          current: body.current,
          endDate: body.current
            ? null
            : existingEducation.endDate,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Education status updated successfully.",
        education,
      });
    }

    if (typeof body.sortOrder === "number") {
      const education = await prisma.education.update({
        where: {
          id: existingEducation.id,
        },
        data: {
          sortOrder: body.sortOrder,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Education order updated successfully.",
        education,
      });
    }

    return NextResponse.json({
      success: true,
      message: "No changes were requested.",
      education: existingEducation,
    });
  } catch (error) {
    console.error("Education PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update education.",
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
          message: "Education ID is required.",
        },
        { status: 400 }
      );
    }

    const existingEducation = await prisma.education.findFirst({
      where: {
        id,
        portfolioId: portfolio.id,
      },
    });

    if (!existingEducation) {
      return NextResponse.json(
        {
          success: false,
          message: "Education record not found.",
        },
        { status: 404 }
      );
    }

    await prisma.education.delete({
      where: {
        id: existingEducation.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Education deleted successfully.",
    });
  } catch (error) {
    console.error("Education DELETE error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to delete education.",
      },
      { status: 500 }
    );
  }
}