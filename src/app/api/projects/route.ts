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

    const projects = await prisma.project.findMany({
      where: {
        portfolioId: portfolio.id,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      projects,
    });
  } catch (error) {
    console.error("Projects GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load projects.",
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

    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    const image = String(body.image ?? "").trim();
    const link = String(body.link ?? "").trim();
    const category = String(body.category ?? "").trim();
    const technologies = String(body.technologies ?? "").trim();
    const featured = Boolean(body.featured);

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          message: "Project title is required.",
        },
        { status: 400 }
      );
    }

    const lastProject = await prisma.project.findFirst({
      where: {
        portfolioId: portfolio.id,
      },
      orderBy: {
        sortOrder: "desc",
      },
    });

    const project = await prisma.project.create({
      data: {
        portfolioId: portfolio.id,
        title,
        description,
        image: image || null,
        link: link || null,
        category: category || null,
        technologies: technologies || null,
        featured,
        sortOrder: (lastProject?.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Project added successfully.",
        project,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Projects POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to add project.",
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
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    const image = String(body.image ?? "").trim();
    const link = String(body.link ?? "").trim();
    const category = String(body.category ?? "").trim();
    const technologies = String(body.technologies ?? "").trim();
    const featured = Boolean(body.featured);

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Project ID is required.",
        },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          message: "Project title is required.",
        },
        { status: 400 }
      );
    }

    const existingProject = await prisma.project.findFirst({
      where: {
        id,
        portfolioId: portfolio.id,
      },
    });

    if (!existingProject) {
      return NextResponse.json(
        {
          success: false,
          message: "Project not found.",
        },
        { status: 404 }
      );
    }

    const project = await prisma.project.update({
      where: {
        id: existingProject.id,
      },
      data: {
        title,
        description,
        image: image || null,
        link: link || null,
        category: category || null,
        technologies: technologies || null,
        featured,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Project updated successfully.",
      project,
    });
  } catch (error) {
    console.error("Projects PUT error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update project.",
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
          message: "Project ID is required.",
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

    const currentProject = await prisma.project.findFirst({
      where: {
        id,
        portfolioId: portfolio.id,
      },
    });

    if (!currentProject) {
      return NextResponse.json(
        {
          success: false,
          message: "Project not found.",
        },
        { status: 404 }
      );
    }

    const neighboringProject = await prisma.project.findFirst({
      where: {
        portfolioId: portfolio.id,
        ...(direction === "up"
          ? {
              sortOrder: {
                lt: currentProject.sortOrder,
              },
            }
          : {
              sortOrder: {
                gt: currentProject.sortOrder,
              },
            }),
      },
      orderBy: {
        sortOrder: direction === "up" ? "desc" : "asc",
      },
    });

    if (!neighboringProject) {
      return NextResponse.json({
        success: true,
        message:
          direction === "up"
            ? "Project is already first."
            : "Project is already last.",
      });
    }

    await prisma.$transaction([
      prisma.project.update({
        where: {
          id: currentProject.id,
        },
        data: {
          sortOrder: neighboringProject.sortOrder,
        },
      }),
      prisma.project.update({
        where: {
          id: neighboringProject.id,
        },
        data: {
          sortOrder: currentProject.sortOrder,
        },
      }),
    ]);

    const projects = await prisma.project.findMany({
      where: {
        portfolioId: portfolio.id,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Project order updated successfully.",
      projects,
    });
  } catch (error) {
    console.error("Projects PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to reorder projects.",
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
          message: "Project ID is required.",
        },
        { status: 400 }
      );
    }

    const project = await prisma.project.findFirst({
      where: {
        id,
        portfolioId: portfolio.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          message: "Project not found.",
        },
        { status: 404 }
      );
    }

    await prisma.project.delete({
      where: {
        id: project.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Project deleted successfully.",
    });
  } catch (error) {
    console.error("Projects DELETE error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to delete project.",
      },
      { status: 500 }
    );
  }
}