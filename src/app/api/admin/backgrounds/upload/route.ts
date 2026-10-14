
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "Please select an image." },
        { status: 400 }
      );
    }

    const extension = ALLOWED_TYPES[file.type];

    if (!extension) {
      return NextResponse.json(
        {
          success: false,
          message: "Choose a JPG, PNG, or WebP image.",
        },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: "The image must be smaller than 5 MB.",
        },
        { status: 400 }
      );
    }

    const filePath = `backgrounds/${randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("portfolio-backgrounds")
      .upload(filePath, await file.arrayBuffer(), {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Background upload error:", uploadError);

      return NextResponse.json(
        {
          success: false,
          message:
            "Upload failed. Check that the portfolio-backgrounds bucket exists and is accessible.",
        },
        { status: 500 }
      );
    }

    const { data } = supabase.storage
      .from("portfolio-backgrounds")
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      url: data.publicUrl,
    });
  } catch (error) {
    console.error("Background upload error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to upload the image." },
      { status: 500 }
    );
  }
}