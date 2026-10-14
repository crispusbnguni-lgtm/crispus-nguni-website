import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

const BUCKET_NAME = "portfolio-media";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
];

type MediaVisibility = "PRIVATE" | "PUBLIC";

function getMediaType(mimeType: string) {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return "IMAGE" as const;
  }

  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) {
    return "VIDEO" as const;
  }

  if (ALLOWED_DOCUMENT_TYPES.includes(mimeType)) {
    return "DOCUMENT" as const;
  }

  return null;
}

function getMaxSize(
  type: "IMAGE" | "VIDEO" | "DOCUMENT"
) {
  if (type === "IMAGE") {
    return MAX_IMAGE_SIZE;
  }

  if (type === "VIDEO") {
    return MAX_VIDEO_SIZE;
  }

  return MAX_DOCUMENT_SIZE;
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getVisibility(
  value: FormDataEntryValue | null
): MediaVisibility {
  return value === "PUBLIC" ? "PUBLIC" : "PRIVATE";
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

    const formData = await request.formData();

    const file = formData.get("file");

    const adminUserId = String(
      formData.get("adminUserId") ?? ""
    ).trim();

    const altText = String(
      formData.get("altText") ?? ""
    ).trim();

    const visibility = getVisibility(
      formData.get("visibility")
    );

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "Please select a file to upload.",
        },
        { status: 400 }
      );
    }

    /*
     * Only SUPER_ADMIN may upload media into
     * another user's portfolio.
     */
    if (
      adminUserId &&
      user.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You are not authorized to upload media for this user.",
        },
        { status: 403 }
      );
    }

    const targetUserId =
      adminUserId || user.id;

    const portfolio =
      await prisma.portfolioSite.findUnique({
        where: {
          userId: targetUserId,
        },
        select: {
          id: true,
        },
      });

    if (!portfolio) {
      return NextResponse.json(
        {
          success: false,
          message: "Portfolio not found.",
        },
        { status: 404 }
      );
    }

    const mimeType = file.type;

    const mediaType =
      getMediaType(mimeType);

    if (!mediaType) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unsupported file type. Allowed files are JPG, PNG, WEBP, GIF, MP4, WEBM, MOV, and PDF.",
        },
        { status: 400 }
      );
    }

    const maxSize =
      getMaxSize(mediaType);

    if (file.size > maxSize) {
      const limit =
        mediaType === "VIDEO"
          ? "100 MB"
          : mediaType === "IMAGE"
            ? "10 MB"
            : "20 MB";

      return NextResponse.json(
        {
          success: false,
          message: `This file is too large. The maximum size for ${mediaType.toLowerCase()} files is ${limit}.`,
        },
        { status: 400 }
      );
    }

    const safeName =
      sanitizeFileName(file.name) ||
      `file-${Date.now()}`;

    const extension =
      safeName.includes(".")
        ? safeName.substring(
            safeName.lastIndexOf(".")
          )
        : "";

    const uniqueName =
      `${Date.now()}-${crypto.randomUUID()}${extension}`;

    const storagePath =
      `${portfolio.id}/${mediaType.toLowerCase()}/${uniqueName}`;

    const fileBuffer =
      Buffer.from(
        await file.arrayBuffer()
      );

    const {
      error: uploadError,
    } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(
        storagePath,
        fileBuffer,
        {
          contentType: mimeType,
          upsert: false,
        }
      );

    if (uploadError) {
      console.error(
        "Supabase media upload error:",
        uploadError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Unable to upload the file to storage.",
        },
        { status: 500 }
      );
    }

    const media =
      await prisma.media.create({
        data: {
          portfolioId: portfolio.id,
          uploadedById: user.id,
          name: safeName,
          originalName: file.name,
          storagePath,
          mimeType,
          size: file.size,
          type: mediaType,
          visibility,
          altText: altText || null,
        },
      });

    return NextResponse.json(
      {
        success: true,
        message:
          "File uploaded successfully.",
        media: {
          id: media.id,
          name: media.name,
          originalName:
            media.originalName,
          mimeType: media.mimeType,
          size: media.size,
          type: media.type,
          visibility:
            media.visibility,
          storagePath:
            media.storagePath,
          altText: media.altText,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Media upload error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Something went wrong while uploading the file.",
      },
      { status: 500 }
    );
  }
}