import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getTargetUserId(
  user: {
    id: string;
    role: string;
  },
  adminUserId: string
) {
  if (adminUserId) {
    if (user.role !== "SUPER_ADMIN") {
      return null;
    }

    return adminUserId;
  }

  return user.id;
}

async function getPortfolioForUser(userId: string) {
  return prisma.portfolioSite.findUnique({
    where: {
      userId,
    },
    select: {
      id: true,
    },
  });
}

async function validateMedia(
  mediaIds: string[],
  portfolioId: string
) {
  if (mediaIds.length === 0) {
    return {
      valid: true,
      media: [],
    };
  }

  const media = await prisma.media.findMany({
    where: {
      id: {
        in: mediaIds,
      },
      portfolioId,
    },
    select: {
      id: true,
      type: true,
    },
  });

  if (media.length !== mediaIds.length) {
    return {
      valid: false,
      message:
        "One or more selected media files do not belong to this portfolio.",
      media: [],
    };
  }

  const invalidMedia = media.some(
    (item) =>
      item.type !== "IMAGE" &&
      item.type !== "VIDEO"
  );

  if (invalidMedia) {
    return {
      valid: false,
      message: "Posts can only contain images and videos.",
      media: [],
    };
  }

  return {
    valid: true,
    media,
  };
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "You must be logged in.",
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const adminUserId =
      searchParams.get("adminUserId")?.trim() ?? "";

    const targetUserId = getTargetUserId(
      user,
      adminUserId
    );

    if (!targetUserId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You are not authorized to access this portfolio.",
        },
        { status: 403 }
      );
    }

    const portfolio =
      await getPortfolioForUser(targetUserId);

    if (!portfolio) {
      return NextResponse.json(
        {
          success: false,
          message: "Portfolio not found.",
        },
        { status: 404 }
      );
    }

    const posts = await prisma.post.findMany({
      where: {
        portfolioId: portfolio.id,
      },
      orderBy: [
        {
          featured: "desc",
        },
        {
          publishedAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      include: {
        media: {
          orderBy: {
            sortOrder: "asc",
          },
          include: {
            media: {
              select: {
                id: true,
                name: true,
                originalName: true,
                mimeType: true,
                size: true,
                type: true,
                visibility: true,
                storagePath: true,
                altText: true,
                width: true,
                height: true,
                duration: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      posts,
    });
  } catch (error) {
    console.error("Posts GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Something went wrong while loading posts.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "You must be logged in.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const caption =
      typeof body.caption === "string"
        ? body.caption.trim()
        : "";

    const visibility =
      body.visibility === "PUBLISHED"
        ? "PUBLISHED"
        : "DRAFT";

    const featured = body.featured === true;

    const adminUserId =
      typeof body.adminUserId === "string"
        ? body.adminUserId.trim()
        : "";

    const mediaIds = Array.isArray(body.mediaIds)
      ? body.mediaIds.filter(
          (id: unknown): id is string =>
            typeof id === "string" &&
            id.trim().length > 0
        )
      : [];

    const targetUserId = getTargetUserId(
      user,
      adminUserId
    );

    if (!targetUserId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You are not authorized to create posts for this portfolio.",
        },
        { status: 403 }
      );
    }

    if (!caption && mediaIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A post must contain a caption or at least one media file.",
        },
        { status: 400 }
      );
    }

    if (mediaIds.length > 20) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A post can contain a maximum of 20 media files.",
        },
        { status: 400 }
      );
    }

    const portfolio =
      await getPortfolioForUser(targetUserId);

    if (!portfolio) {
      return NextResponse.json(
        {
          success: false,
          message: "Portfolio not found.",
        },
        { status: 404 }
      );
    }

    const mediaValidation = await validateMedia(
      mediaIds,
      portfolio.id
    );

    if (!mediaValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          message:
            mediaValidation.message ??
            "Invalid media files.",
        },
        { status: 400 }
      );
    }

    const post = await prisma.post.create({
      data: {
        portfolioId: portfolio.id,
        createdById: user.id,
        caption: caption || null,
        visibility,
        featured,
        publishedAt:
          visibility === "PUBLISHED"
            ? new Date()
            : null,
        media: {
          create: mediaIds.map(
            (mediaId: string, index: number) => ({
              mediaId,
              sortOrder: index,
            })
          ),
        },
      },
      include: {
        media: {
          orderBy: {
            sortOrder: "asc",
          },
          include: {
            media: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message:
          visibility === "PUBLISHED"
            ? "Post published successfully."
            : "Post saved as draft.",
        post,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Posts POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Something went wrong while creating the post.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "You must be logged in.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const postId =
      typeof body.postId === "string"
        ? body.postId.trim()
        : "";

    const caption =
      typeof body.caption === "string"
        ? body.caption.trim()
        : "";

    const visibility =
      body.visibility === "PUBLISHED"
        ? "PUBLISHED"
        : "DRAFT";

    const featured = body.featured === true;

    const adminUserId =
      typeof body.adminUserId === "string"
        ? body.adminUserId.trim()
        : "";

    const mediaIds = Array.isArray(body.mediaIds)
      ? body.mediaIds.filter(
          (id: unknown): id is string =>
            typeof id === "string" &&
            id.trim().length > 0
        )
      : [];

    if (!postId) {
      return NextResponse.json(
        {
          success: false,
          message: "Post ID is required.",
        },
        { status: 400 }
      );
    }

    if (!caption && mediaIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A post must contain a caption or at least one media file.",
        },
        { status: 400 }
      );
    }

    if (mediaIds.length > 20) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A post can contain a maximum of 20 media files.",
        },
        { status: 400 }
      );
    }

    const targetUserId = getTargetUserId(
      user,
      adminUserId
    );

    if (!targetUserId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You are not authorized to edit posts for this portfolio.",
        },
        { status: 403 }
      );
    }

    const portfolio =
      await getPortfolioForUser(targetUserId);

    if (!portfolio) {
      return NextResponse.json(
        {
          success: false,
          message: "Portfolio not found.",
        },
        { status: 404 }
      );
    }

    const existingPost =
      await prisma.post.findFirst({
        where: {
          id: postId,
          portfolioId: portfolio.id,
        },
        select: {
          id: true,
          visibility: true,
          publishedAt: true,
        },
      });

    if (!existingPost) {
      return NextResponse.json(
        {
          success: false,
          message: "Post not found.",
        },
        { status: 404 }
      );
    }

    const mediaValidation = await validateMedia(
      mediaIds,
      portfolio.id
    );

    if (!mediaValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          message:
            mediaValidation.message ??
            "Invalid media files.",
        },
        { status: 400 }
      );
    }

    let publishedAt = existingPost.publishedAt;

    if (
      visibility === "PUBLISHED" &&
      existingPost.visibility !== "PUBLISHED"
    ) {
      publishedAt = new Date();
    }

    if (visibility === "DRAFT") {
      publishedAt = null;
    }

    const updatedPost =
      await prisma.$transaction(
        async (transaction) => {
          await transaction.postMedia.deleteMany({
            where: {
              postId,
            },
          });

          return transaction.post.update({
            where: {
              id: postId,
            },
            data: {
              caption: caption || null,
              visibility,
              featured,
              publishedAt,
              media: {
                create: mediaIds.map(
                  (
                    mediaId: string,
                    index: number
                  ) => ({
                    mediaId,
                    sortOrder: index,
                  })
                ),
              },
            },
            include: {
              media: {
                orderBy: {
                  sortOrder: "asc",
                },
                include: {
                  media: true,
                },
              },
            },
          });
        }
      );

    return NextResponse.json({
      success: true,
      message:
        visibility === "PUBLISHED"
          ? "Post updated successfully."
          : "Post saved as draft.",
      post: updatedPost,
    });
  } catch (error) {
    console.error("Posts PUT error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Something went wrong while updating the post.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "You must be logged in.",
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const postId =
      searchParams.get("postId")?.trim() ?? "";

    const adminUserId =
      searchParams.get("adminUserId")?.trim() ?? "";

    if (!postId) {
      return NextResponse.json(
        {
          success: false,
          message: "Post ID is required.",
        },
        { status: 400 }
      );
    }

    const targetUserId = getTargetUserId(
      user,
      adminUserId
    );

    if (!targetUserId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You are not authorized to delete posts for this portfolio.",
        },
        { status: 403 }
      );
    }

    const portfolio =
      await getPortfolioForUser(targetUserId);

    if (!portfolio) {
      return NextResponse.json(
        {
          success: false,
          message: "Portfolio not found.",
        },
        { status: 404 }
      );
    }

    const post =
      await prisma.post.findFirst({
        where: {
          id: postId,
          portfolioId: portfolio.id,
        },
        select: {
          id: true,
        },
      });

    if (!post) {
      return NextResponse.json(
        {
          success: false,
          message: "Post not found.",
        },
        { status: 404 }
      );
    }

    await prisma.post.delete({
      where: {
        id: post.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Post deleted successfully.",
    });
  } catch (error) {
    console.error("Posts DELETE error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Something went wrong while deleting the post.",
      },
      { status: 500 }
    );
  }
}