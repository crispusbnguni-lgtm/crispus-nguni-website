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

    const skills = await prisma.skill.findMany({
      where: {
        portfolioId: portfolio.id,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      skills,
    });
  } catch (error) {
    console.error("Skills GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load skills.",
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

    const name = String(body.name ?? "").trim();
    const category = String(body.category ?? "").trim();
    const level = String(body.level ?? "").trim();
    const description = String(body.description ?? "").trim();

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Skill name is required.",
        },
        { status: 400 }
      );
    }

    const lastSkill = await prisma.skill.findFirst({
      where: {
        portfolioId: portfolio.id,
      },
      orderBy: {
        sortOrder: "desc",
      },
    });

    const skill = await prisma.skill.create({
      data: {
        portfolioId: portfolio.id,
        name,
        category: category || null,
        level: level || null,
        description: description || null,
        sortOrder: (lastSkill?.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Skill added successfully.",
        skill,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Skills POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to add skill.",
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
    const name = String(body.name ?? "").trim();
    const category = String(body.category ?? "").trim();
    const level = String(body.level ?? "").trim();
    const description = String(body.description ?? "").trim();

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Skill ID is required.",
        },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Skill name is required.",
        },
        { status: 400 }
      );
    }

    const existingSkill = await prisma.skill.findFirst({
      where: {
        id,
        portfolioId: portfolio.id,
      },
    });

    if (!existingSkill) {
      return NextResponse.json(
        {
          success: false,
          message: "Skill not found.",
        },
        { status: 404 }
      );
    }

    const skill = await prisma.skill.update({
      where: {
        id: existingSkill.id,
      },
      data: {
        name,
        category: category || null,
        level: level || null,
        description: description || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Skill updated successfully.",
      skill,
    });
  } catch (error) {
    console.error("Skills PUT error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update skill.",
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
          message: "Skill ID is required.",
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

    const currentSkill = await prisma.skill.findFirst({
      where: {
        id,
        portfolioId: portfolio.id,
      },
    });

    if (!currentSkill) {
      return NextResponse.json(
        {
          success: false,
          message: "Skill not found.",
        },
        { status: 404 }
      );
    }

    const neighboringSkill = await prisma.skill.findFirst({
      where: {
        portfolioId: portfolio.id,
        ...(direction === "up"
          ? {
              sortOrder: {
                lt: currentSkill.sortOrder,
              },
            }
          : {
              sortOrder: {
                gt: currentSkill.sortOrder,
              },
            }),
      },
      orderBy: {
        sortOrder: direction === "up" ? "desc" : "asc",
      },
    });

    if (!neighboringSkill) {
      return NextResponse.json({
        success: true,
        message:
          direction === "up"
            ? "Skill is already first."
            : "Skill is already last.",
      });
    }

    await prisma.$transaction([
      prisma.skill.update({
        where: {
          id: currentSkill.id,
        },
        data: {
          sortOrder: neighboringSkill.sortOrder,
        },
      }),
      prisma.skill.update({
        where: {
          id: neighboringSkill.id,
        },
        data: {
          sortOrder: currentSkill.sortOrder,
        },
      }),
    ]);

    const skills = await prisma.skill.findMany({
      where: {
        portfolioId: portfolio.id,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Skill order updated successfully.",
      skills,
    });
  } catch (error) {
    console.error("Skills PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to reorder skills.",
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
          message: "Skill ID is required.",
        },
        { status: 400 }
      );
    }

    const skill = await prisma.skill.findFirst({
      where: {
        id,
        portfolioId: portfolio.id,
      },
    });

    if (!skill) {
      return NextResponse.json(
        {
          success: false,
          message: "Skill not found.",
        },
        { status: 404 }
      );
    }

    await prisma.skill.delete({
      where: {
        id: skill.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Skill deleted successfully.",
    });
  } catch (error) {
    console.error("Skills DELETE error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to delete skill.",
      },
      { status: 500 }
    );
  }
}