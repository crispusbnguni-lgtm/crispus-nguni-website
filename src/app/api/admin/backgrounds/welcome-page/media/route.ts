
import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  requireApiPermission,
  requireSameOriginApiRequest,
} from "@/lib/authorization";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hasAllowedBackgroundMediaSignature } from "@/lib/background-media";
import { reportOperationalFailure } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { lockBackgroundOptionWrites } from "@/lib/background-governance";
import { resolveAdminAuditActor, writeAdminAudit } from "@/lib/admin-audit";

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

const ALLOWED_MEDIA_PATH =
  /^(images|videos)\/[A-Za-z0-9-]+\.(jpg|png|webp|avif|gif|mp4|webm)$/;

function containsExactUrl(value: unknown, targetUrl: string): boolean {
  if (value === targetUrl) return true;

  if (Array.isArray(value)) {
    return value.some((item) => containsExactUrl(item, targetUrl));
  }

  if (value !== null && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(
      (item) => containsExactUrl(item, targetUrl),
    );
  }

  return false;
}

function createMediaAuditId(path: string): string {
  const hash = createHash("sha256").update(path).digest("hex");
  return `media_${hash}`;
}

export async function POST(request: Request) {
  try {
    const authorization = await requireApiPermission("CMS_MANAGE");
    if (authorization.response) return authorization.response;

    const originResponse = requireSameOriginApiRequest(request);
    if (originResponse) return originResponse;

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

    const allowedExtension = ALLOWED_TYPES[file.type];

    if (!allowedExtension) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unsupported file type. Upload JPEG, PNG, WebP, AVIF, GIF, MP4 or WebM.",
        },
        { status: 415 },
      );
    }

    if (
      !(await hasAllowedBackgroundMediaSignature(
        file,
        Object.keys(ALLOWED_TYPES),
      ))
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The selected file contents do not match a supported media type.",
        },
        { status: 415 },
      );
    }

    const extension = allowedExtension;
    const contentType = file.type;
    const isVideo = file.type.startsWith("video/");
    const kind = isVideo ? "videos" : "images";
    const assetType = isVideo ? "video" : "image";

    const path = `${kind}/${Date.now()}-${randomUUID()}.${extension}`;

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType,
        cacheControl: "31536000",
        upsert: false,
      });

    if (error) {
      reportOperationalFailure("ADMIN_STORAGE_OPERATION_FAILED", {
        cause: error,
      });

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
        type: assetType,
        size: file.size,
      },
    });
  } catch (cause) {
    reportOperationalFailure("ADMIN_STORAGE_OPERATION_FAILED", { cause });

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
    const authorization = await requireApiPermission("CMS_MANAGE");
    if (authorization.response) return authorization.response;

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
  } catch (cause) {
    reportOperationalFailure("ADMIN_STORAGE_OPERATION_FAILED", { cause });

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
  let storageDeletionCompleted = false;

  try {
    const authorization = await requireApiPermission("CMS_MANAGE");
    if (authorization.response) return authorization.response;

    const originResponse = requireSameOriginApiRequest(request);
    if (originResponse) return originResponse;

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

    if (!ALLOWED_MEDIA_PATH.test(path)) {
      return NextResponse.json(
        { success: false, message: "Invalid media path." },
        { status: 400 },
      );
    }

    const actor = await resolveAdminAuditActor();

    const deletion = await prisma.$transaction(async (tx) => {
      await lockBackgroundOptionWrites(tx);

      const { data: publicData } = supabaseAdmin.storage
        .from(BUCKET)
        .getPublicUrl(path);

      const settings = await tx.welcomePageSettings.findUnique({
        where: { key: "main" },
        select: { content: true },
      });

      if (
        settings &&
        containsExactUrl(settings.content, publicData.publicUrl)
      ) {
        return { kind: "welcome-page-reference" as const };
      }

      const backgroundReference = await tx.backgroundOption.findFirst({
        where: { value: publicData.publicUrl },
        select: { id: true, name: true },
      });

      if (backgroundReference) {
        return {
          kind: "background-library-reference" as const,
          name: backgroundReference.name,
        };
      }

      const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .remove([path]);

      if (error) {
        return { kind: "storage-error" as const, error };
      }

      storageDeletionCompleted = true;

      const mediaAuditId = createMediaAuditId(path);

      await writeAdminAudit(
        actor,
        {
          action: "ADMIN_BACKGROUND_MEDIA_DELETED",
          targetType: "MediaAsset",
          targetId: mediaAuditId,
          metadata: {
            changedFields: ["media_deleted"],
            storagePath: path,
          },
          reason: "ADMIN_REQUEST",
          outcome: "SUCCEEDED",
        },
        tx,
      );

      return { kind: "deleted" as const };
    });

    if (deletion.kind === "welcome-page-reference") {
      return NextResponse.json(
        {
          success: false,
          message:
            "This media is still referenced by Welcome Page content or its saved history. Update those references before deleting it.",
        },
        { status: 409 },
      );
    }

    if (deletion.kind === "background-library-reference") {
      return NextResponse.json(
        {
          success: false,
          message:
            `This media is still used by the Background Library option "${deletion.name}". Update or remove that option before deleting the file.`,
        },
        { status: 409 },
      );
    }

    if (deletion.kind === "storage-error") {
      reportOperationalFailure("ADMIN_STORAGE_OPERATION_FAILED", {
        cause: deletion.error,
      });

      return NextResponse.json(
        {
          success: false,
          message: "Unable to delete this file from storage.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Media deleted successfully.",
      path,
    });
  } catch (cause) {
    reportOperationalFailure("ADMIN_STORAGE_OPERATION_FAILED", { cause });

    if (storageDeletionCompleted) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The file was removed from storage, but its audit record could not be confirmed. Refresh the Media Library and check the audit log before retrying.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Unable to delete media or permission was denied.",
      },
      { status: 500 },
    );
  }
}
