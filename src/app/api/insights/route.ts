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

function createSlug(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(request: Request) {
  try {
    const { portfolio, error } =
      await getTargetPortfolio(request);

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

    const insights = await prisma.insight.findMany({
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
      insights,
    });
  } catch (error) {
    console.error("Insights GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load insights.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { portfolio, error } =
      await getTargetPortfolio(request);

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
    const excerpt = String(body.excerpt ?? "").trim();
    const content = String(body.content ?? "").trim();
    const coverImage = String(body.coverImage ?? "").trim();
    const category = String(body.category ?? "").trim();
    const published = Boolean(body.published);
    const featured = Boolean(body.featured);
    const publishedAtValue = body.publishedAt;

    if (!title || !content) {
      return NextResponse.json(
        {
          success: false,
          message: "Title and content are required.",
        },
        { status: 400 }
      );
    }

    const baseSlug = createSlug(title) || "insight";

    const existingCount = await prisma.insight.count({
      where: {
        portfolioId: portfolio.id,
        slug: {
          startsWith: baseSlug,
        },
      },
    });

    const slug =
      existingCount === 0
        ? baseSlug
        : `${baseSlug}-${existingCount + 1}`;

    const publishedAt =
      publishedAtValue &&
      !Number.isNaN(Date.parse(publishedAtValue))
        ? new Date(publishedAtValue)
        : published
          ? new Date()
          : null;

    const lastInsight = await prisma.insight.findFirst({
      where: {
        portfolioId: portfolio.id,
      },
      orderBy: {
        sortOrder: "desc",
      },
    });

    const insight = await prisma.insight.create({
      data: {
        portfolioId: portfolio.id,
        title,
        slug,
        excerpt: excerpt || null,
        content,
        coverImage: coverImage || null,
        category: category || null,
        published,
        featured,
        publishedAt,
        sortOrder: (lastInsight?.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Insight created successfully.",
        insight,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Insights POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create insight.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { portfolio, error } =
      await getTargetPortfolio(request);

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
    const excerpt = String(body.excerpt ?? "").trim();
    const content = String(body.content ?? "").trim();
    const coverImage = String(body.coverImage ?? "").trim();
    const category = String(body.category ?? "").trim();
    const published = Boolean(body.published);
    const featured = Boolean(body.featured);
    const publishedAtValue = body.publishedAt;

    if (!id || !title || !content) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Insight ID, title and content are required.",
        },
        { status: 400 }
      );
    }

    const existingInsight = await prisma.insight.findFirst({
      where: {
        id,
        portfolioId: portfolio.id,
      },
    });

    if (!existingInsight) {
      return NextResponse.json(
        {
          success: false,
          message: "Insight not found.",
        },
        { status: 404 }
      );
    }

    const publishedAt =
      publishedAtValue &&
      !Number.isNaN(Date.parse(publishedAtValue))
        ? new Date(publishedAtValue)
        : published
          ? existingInsight.publishedAt || new Date()
          : null;

    const insight = await prisma.insight.update({
      where: {
        id: existingInsight.id,
      },
      data: {
        title,
        excerpt: excerpt || null,
        content,
        coverImage: coverImage || null,
        category: category || null,
        published,
        featured,
        publishedAt,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Insight updated successfully.",
      insight,
    });
  } catch (error) {
    console.error("Insights PUT error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update insight.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { portfolio, error } =
      await getTargetPortfolio(request);

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
          message: "Insight ID is required.",
        },
        { status: 400 }
      );
    }

    const existingInsight = await prisma.insight.findFirst({
      where: {
        id,
        portfolioId: portfolio.id,
      },
    });

    if (!existingInsight) {
      return NextResponse.json(
        {
          success: false,
          message: "Insight not found.",
        },
        { status: 404 }
      );
    }

    const data: {
      published?: boolean;
      featured?: boolean;
      sortOrder?: number;
      publishedAt?: Date | null;
    } = {};

    if (typeof body.published === "boolean") {
      data.published = body.published;

      if (body.published) {
        data.publishedAt =
          existingInsight.publishedAt || new Date();
      } else {
        data.publishedAt = null;
      }
    }

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
        insight: existingInsight,
      });
    }

    const insight = await prisma.insight.update({
      where: {
        id: existingInsight.id,
      },
      data,
    });

    return NextResponse.json({
      success: true,
      message: "Insight updated successfully.",
      insight,
    });
  } catch (error) {
    console.error("Insights PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update insight.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { portfolio, error } =
      await getTargetPortfolio(request);

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
          message: "Insight ID is required.",
        },
        { status: 400 }
      );
    }

    const existingInsight = await prisma.insight.findFirst({
      where: {
        id,
        portfolioId: portfolio.id,
      },
    });

    if (!existingInsight) {
      return NextResponse.json(
        {
          success: false,
          message: "Insight not found.",
        },
        { status: 404 }
      );
    }

    await prisma.insight.delete({
      where: {
        id: existingInsight.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Insight deleted successfully.",
    });
  } catch (error) {
    console.error("Insights DELETE error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to delete insight.",
      },
      { status: 500 }
    );
  }
}