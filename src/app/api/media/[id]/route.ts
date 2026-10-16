import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

const BUCKET_NAME = "portfolio-media";

type MediaRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: MediaRouteProps
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Media ID is required.",
        },
        { status: 400 }
      );
    }

    const media = await prisma.media.findUnique({
      where: {
        id,
      },
      include: {
        portfolio: {
          select: {
            id: true,
            userId: true,
            published: true,
          },
        },
        postMedia: {
          include: {
            post: {
              select: {
                id: true,
                visibility: true,
                portfolioId: true,
              },
            },
          },
        },
      },
    });

    if (!media) {
      return NextResponse.json(
        {
          success: false,
          message: "Media not found.",
        },
        { status: 404 }
      );
    }

    const publicPortfolioAccess =
      media.visibility === "PUBLIC" &&
      media.portfolio.published === true;

    const publishedPostAccess =
      media.postMedia.some(
        (postMedia) =>
          postMedia.post.visibility === "PUBLISHED" &&
          postMedia.post.portfolioId === media.portfolio.id &&
          media.portfolio.published === true
      );

    if (
      !publicPortfolioAccess &&
      !publishedPostAccess
    ) {
      const currentUser = await getCurrentUser();

      const isOwner =
        currentUser?.id === media.portfolio.userId;

      const isSuperAdmin =
        currentUser?.role === "SUPER_ADMIN";

      if (!isOwner && !isSuperAdmin) {
        return NextResponse.json(
          {
            success: false,
            message:
              "This media is not publicly available.",
          },
          { status: 403 }
        );
      }
    }

    const {
      data: file,
      error: downloadError,
    } = await supabase.storage
      .from(BUCKET_NAME)
      .download(media.storagePath);

    if (downloadError || !file) {
      console.error(
        "Supabase media download error:",
        downloadError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Unable to retrieve this media from storage.",
        },
        { status: 500 }
      );
    }

    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type":
          media.mimeType || "application/octet-stream",
        "Content-Length": String(media.size),
        "Cache-Control": publicPortfolioAccess || publishedPostAccess
  ? "public, max-age=3600, s-maxage=3600"
  : "private, no-store",
      },
    });
  } catch (error) {
    console.error(
      "Media delivery error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Something went wrong while loading the media.",
      },
      { status: 500 }
    );
  }
}