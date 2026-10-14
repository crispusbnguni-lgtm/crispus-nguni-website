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

    const services = await prisma.service.findMany({
      where: {
        portfolioId: portfolio.id,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      services,
    });
  } catch (error) {
    console.error("Services GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load services.",
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
    const icon = String(body.icon ?? "").trim();
    const price = String(body.price ?? "").trim();
    const link = String(body.link ?? "").trim();

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          message: "Service title is required.",
        },
        { status: 400 }
      );
    }

    const lastService = await prisma.service.findFirst({
      where: {
        portfolioId: portfolio.id,
      },
      orderBy: {
        sortOrder: "desc",
      },
    });

    const service = await prisma.service.create({
      data: {
        portfolioId: portfolio.id,
        title,
        description: description || null,
        icon: icon || null,
        price: price || null,
        link: link || null,
        sortOrder: (lastService?.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Service created successfully.",
        service,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Services POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create service.",
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
    const icon = String(body.icon ?? "").trim();
    const price = String(body.price ?? "").trim();
    const link = String(body.link ?? "").trim();

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Service ID is required.",
        },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          message: "Service title is required.",
        },
        { status: 400 }
      );
    }

    const existingService = await prisma.service.findFirst({
      where: {
        id,
        portfolioId: portfolio.id,
      },
    });

    if (!existingService) {
      return NextResponse.json(
        {
          success: false,
          message: "Service not found.",
        },
        { status: 404 }
      );
    }

    const service = await prisma.service.update({
      where: {
        id: existingService.id,
      },
      data: {
        title,
        description: description || null,
        icon: icon || null,
        price: price || null,
        link: link || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Service updated successfully.",
      service,
    });
  } catch (error) {
    console.error("Services PUT error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update service.",
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
          message: "Service ID is required.",
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

    const currentService = await prisma.service.findFirst({
      where: {
        id,
        portfolioId: portfolio.id,
      },
    });

    if (!currentService) {
      return NextResponse.json(
        {
          success: false,
          message: "Service not found.",
        },
        { status: 404 }
      );
    }

    const neighboringService = await prisma.service.findFirst({
      where: {
        portfolioId: portfolio.id,
        ...(direction === "up"
          ? {
              sortOrder: {
                lt: currentService.sortOrder,
              },
            }
          : {
              sortOrder: {
                gt: currentService.sortOrder,
              },
            }),
      },
      orderBy: {
        sortOrder: direction === "up" ? "desc" : "asc",
      },
    });

    if (!neighboringService) {
      return NextResponse.json({
        success: true,
        message:
          direction === "up"
            ? "Service is already first."
            : "Service is already last.",
      });
    }

    await prisma.$transaction([
      prisma.service.update({
        where: {
          id: currentService.id,
        },
        data: {
          sortOrder: neighboringService.sortOrder,
        },
      }),
      prisma.service.update({
        where: {
          id: neighboringService.id,
        },
        data: {
          sortOrder: currentService.sortOrder,
        },
      }),
    ]);

    const services = await prisma.service.findMany({
      where: {
        portfolioId: portfolio.id,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Service order updated successfully.",
      services,
    });
  } catch (error) {
    console.error("Services PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to reorder services.",
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
          message: "Service ID is required.",
        },
        { status: 400 }
      );
    }

    const service = await prisma.service.findFirst({
      where: {
        id,
        portfolioId: portfolio.id,
      },
    });

    if (!service) {
      return NextResponse.json(
        {
          success: false,
          message: "Service not found.",
        },
        { status: 404 }
      );
    }

    await prisma.service.delete({
      where: {
        id: service.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Service deleted successfully.",
    });
  } catch (error) {
    console.error("Services DELETE error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to delete service.",
      },
      { status: 500 }
    );
  }
}