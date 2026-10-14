import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/authorization";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "welcome-page-media";
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "Select a file to upload." },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { success: false, message: "The selected file is empty." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: "Files must be 50 MB or smaller.",
        },
        { status: 413 },
      );
    }

    const extension = ALLOWED_TYPES[file.type];

    if (!extension) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unsupported file type. Upload JPEG, PNG, WebP, AVIF, GIF, MP4 or WebM.",
        },
        { status: 415 },
      );
    }

    const kind = file.type.startsWith("video/")
      ? "videos"
      : "images";

    const path = `${kind}/${Date.now()}-${randomUUID()}.${extension}`;

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });

    if (error) {
      console.error("Supabase media upload failed:", error.message);

      return NextResponse.json(
        {
          success: false,
          message: "Upload failed. Check your bucket settings.",
        },
        { status: 502 },
      );
    }

    const { data } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(path);

    return NextResponse.json({
      success: true,
      message: "Media uploaded successfully.",
      asset: {
        path,
        url: data.publicUrl,
        name: file.name,
        type: file.type,
        size: file.size,
      },
    });
  } catch (error) {
    console.error("Welcome page media upload failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Upload failed or you do not have permission.",
      },
      { status: 500 },
    );
  }
}
export async function GET() {
  try {
    await requireSuperAdmin();

    const folders = ["images", "videos"] as const;

    const results = await Promise.all(
      folders.map(async (folder) => {
        const { data, error } = await supabaseAdmin.storage
          .from(BUCKET)
          .list(folder, {
            limit: 100,
            offset: 0,
            sortBy: { column: "created_at", order: "desc" },
          });

        if (error) {
          throw new Error(`Unable to list ${folder}.`);
        }

        return (data ?? [])
          .filter((item) => item.id !== null)
          .map((item) => {
            const path = `${folder}/${item.name}`;
            const { data: publicData } = supabaseAdmin.storage
              .from(BUCKET)
              .getPublicUrl(path);

            return {
              path,
              url: publicData.publicUrl,
              name: item.name,
              type: folder === "videos" ? "video" : "image",
              size:
                typeof item.metadata?.size === "number"
                  ? item.metadata.size
                  : 0,
              createdAt: item.created_at ?? null,
            };
          });
      }),
    );

    return NextResponse.json({
      success: true,
      assets: results.flat().sort((a, b) => {
        return (
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime()
        );
      }),
    });
  } catch (error) {
    console.error("Unable to list welcome page media:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load media library.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await requireSuperAdmin();

    const body: unknown = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      !("path" in body) ||
      typeof body.path !== "string"
    ) {
      return NextResponse.json(
        { success: false, message: "A valid media path is required." },
        { status: 400 },
      );
    }

    const path = body.path;

    // Only permit files in the folders created by our upload endpoint.
    const isAllowedPath =
      /^(images|videos)\/[a-zA-Z0-9-]+\.(jpg|png|webp|avif|gif|mp4|webm)$/.test(
        path,
      );

    if (!isAllowedPath) {
      return NextResponse.json(
        { success: false, message: "Invalid media path." },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .remove([path]);

    if (error) {
      console.error("Supabase media deletion failed:", error.message);

      return NextResponse.json(
        { success: false, message: "Unable to delete this file." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Media deleted successfully.",
      path,
    });
  } catch (error) {
    console.error("Welcome page media deletion failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to delete media or permission was denied.",
      },
      { status: 500 },
    );
  }
}