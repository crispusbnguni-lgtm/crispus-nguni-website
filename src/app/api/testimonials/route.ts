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

    const testimonials = await prisma.testimonial.findMany({
      where: {
        portfolioId: portfolio.id,
      },
      orderBy: [
        {
          featured: "desc",
        },
        {
          sortOrder: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    return NextResponse.json({
      success: true,
      testimonials,
    });
  } catch (error) {
    console.error("Testimonials GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load testimonials.",
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
    const role = String(body.role ?? "").trim();
    const company = String(body.company ?? "").trim();
    const message = String(body.message ?? "").trim();
    const image = String(body.image ?? "").trim();
    const ratingValue = body.rating;
    const featured = Boolean(body.featured);

    if (!name || !message) {
      return NextResponse.json(
        {
          success: false,
          message: "Name and testimonial message are required.",
        },
        { status: 400 }
      );
    }

    let rating: number | null = null;

    if (
      ratingValue !== undefined &&
      ratingValue !== null &&
      ratingValue !== ""
    ) {
      const parsedRating = Number(ratingValue);

      if (
        !Number.isInteger(parsedRating) ||
        parsedRating < 1 ||
        parsedRating > 5
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Rating must be a whole number between 1 and 5.",
          },
          { status: 400 }
        );
      }

      rating = parsedRating;
    }

    const lastTestimonial = await prisma.testimonial.findFirst({
      where: {
        portfolioId: portfolio.id,
      },
      orderBy: {
        sortOrder: "desc",
      },
    });

    const testimonial = await prisma.testimonial.create({
      data: {
        portfolioId: portfolio.id,
        name,
        role: role || null,
        company: company || null,
        message,
        image: image || null,
        rating,
        featured,
        sortOrder: (lastTestimonial?.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Testimonial created successfully.",
        testimonial,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Testimonials POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create testimonial.",
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
    const role = String(body.role ?? "").trim();
    const company = String(body.company ?? "").trim();
    const message = String(body.message ?? "").trim();
    const image = String(body.image ?? "").trim();
    const ratingValue = body.rating;
    const featured = Boolean(body.featured);

    if (!id || !name || !message) {
      return NextResponse.json(
        {
          success: false,
          message: "Testimonial ID, name and message are required.",
        },
        { status: 400 }
      );
    }

    const existingTestimonial = await prisma.testimonial.findFirst({
      where: {
        id,
        portfolioId: portfolio.id,
      },
    });

    if (!existingTestimonial) {
      return NextResponse.json(
        {
          success: false,
          message: "Testimonial not found.",
        },
        { status: 404 }
      );
    }

    let rating: number | null = null;

    if (
      ratingValue !== undefined &&
      ratingValue !== null &&
      ratingValue !== ""
    ) {
      const parsedRating = Number(ratingValue);

      if (
        !Number.isInteger(parsedRating) ||
        parsedRating < 1 ||
        parsedRating > 5
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Rating must be a whole number between 1 and 5.",
          },
          { status: 400 }
        );
      }

      rating = parsedRating;
    }

    const testimonial = await prisma.testimonial.update({
      where: {
        id: existingTestimonial.id,
      },
      data: {
        name,
        role: role || null,
        company: company || null,
        message,
        image: image || null,
        rating,
        featured,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Testimonial updated successfully.",
      testimonial,
    });
  } catch (error) {
    console.error("Testimonials PUT error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update testimonial.",
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
          message: "Testimonial ID is required.",
        },
        { status: 400 }
      );
    }

    const existingTestimonial = await prisma.testimonial.findFirst({
      where: {
        id,
        portfolioId: portfolio.id,
      },
    });

    if (!existingTestimonial) {
      return NextResponse.json(
        {
          success: false,
          message: "Testimonial not found.",
        },
        { status: 404 }
      );
    }

    if (typeof body.direction === "string") {
      const direction = body.direction.trim();

      if (direction !== "up" && direction !== "down") {
        return NextResponse.json(
          {
            success: false,
            message: "A valid reorder direction is required.",
          },
          { status: 400 }
        );
      }

      const neighboringTestimonial =
        await prisma.testimonial.findFirst({
          where: {
            portfolioId: portfolio.id,
            ...(direction === "up"
              ? {
                  sortOrder: {
                    lt: existingTestimonial.sortOrder,
                  },
                }
              : {
                  sortOrder: {
                    gt: existingTestimonial.sortOrder,
                  },
                }),
          },
          orderBy: {
            sortOrder: direction === "up" ? "desc" : "asc",
          },
        });

      if (!neighboringTestimonial) {
        return NextResponse.json({
          success: true,
          message:
            direction === "up"
              ? "Testimonial is already first."
              : "Testimonial is already last.",
        });
      }

      await prisma.$transaction([
        prisma.testimonial.update({
          where: {
            id: existingTestimonial.id,
          },
          data: {
            sortOrder: neighboringTestimonial.sortOrder,
          },
        }),
        prisma.testimonial.update({
          where: {
            id: neighboringTestimonial.id,
          },
          data: {
            sortOrder: existingTestimonial.sortOrder,
          },
        }),
      ]);

      const testimonials = await prisma.testimonial.findMany({
        where: {
          portfolioId: portfolio.id,
        },
        orderBy: [
          {
            featured: "desc",
          },
          {
            sortOrder: "asc",
          },
          {
            createdAt: "desc",
          },
        ],
      });

      return NextResponse.json({
        success: true,
        message: "Testimonial order updated successfully.",
        testimonials,
      });
    }

    const data: {
      featured?: boolean;
      sortOrder?: number;
    } = {};

    if (typeof body.featured === "boolean") {
      data.featured = body.featured;
    }

    if (typeof body.sortOrder === "number") {
      data.sortOrder = body.sortOrder;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({
        success: true,
        message: "No changes were requested.",
        testimonial: existingTestimonial,
      });
    }

    const testimonial = await prisma.testimonial.update({
      where: {
        id: existingTestimonial.id,
      },
      data,
    });

    return NextResponse.json({
      success: true,
      message: "Testimonial updated successfully.",
      testimonial,
    });
  } catch (error) {
    console.error("Testimonials PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update testimonial.",
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
          message: "Testimonial ID is required.",
        },
        { status: 400 }
      );
    }

    const existingTestimonial = await prisma.testimonial.findFirst({
      where: {
        id,
        portfolioId: portfolio.id,
      },
    });

    if (!existingTestimonial) {
      return NextResponse.json(
        {
          success: false,
          message: "Testimonial not found.",
        },
        { status: 404 }
      );
    }

    await prisma.testimonial.delete({
      where: {
        id: existingTestimonial.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Testimonial deleted successfully.",
    });
  } catch (error) {
    console.error("Testimonials DELETE error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to delete testimonial.",
      },
      { status: 500 }
    );
  }
}