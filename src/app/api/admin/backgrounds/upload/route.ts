import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireApiSuperAdmin, requireSameOriginApiRequest } from "@/lib/authorization";
import { resolveAdminAuditActor, writeAdminAudit } from "@/lib/admin-audit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hasAllowedBackgroundMediaSignature } from "@/lib/background-media";
import { lockBackgroundOptionWrites } from "@/lib/background-governance";
import { prisma } from "@/lib/prisma";
import { reportOperationalFailure } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, max-age=0" } });

export async function POST(request: Request) {
  const originResponse = requireSameOriginApiRequest(request);
  if (originResponse) return originResponse;
  const authorization = await requireApiSuperAdmin();
  if (authorization.response) return authorization.response;

  let uploadedPath: string | null = null;
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return json({ success: false, message: "Please select an image." }, 400);
    const extension = ALLOWED_TYPES[file.type];
    if (!extension) return json({ success: false, message: "Choose a JPG, PNG, or WebP image." }, 400);
    if (file.size < 1 || file.size > MAX_FILE_SIZE) return json({ success: false, message: "The image must be 5 MB or smaller." }, 413);
    if (!await hasAllowedBackgroundMediaSignature(file, Object.keys(ALLOWED_TYPES))) return json({ success: false, message: "The selected file contents do not match a supported image type." }, 415);

    const suppliedName = formData.get("name");
    const fallbackName = file.name.replace(/\.[^.]+$/, "").replace(/[\u0000-\u001f]/g, " ").trim();
    const proposedName = typeof suppliedName === "string" && suppliedName.trim() ? suppliedName.trim() : fallbackName || "Uploaded background";
    if (proposedName.length > 100) return json({ success: false, message: "Background names must be 100 characters or fewer." }, 400);
    const name = proposedName;
    const suppliedDescription = formData.get("description");
    if (suppliedDescription !== null && (typeof suppliedDescription !== "string" || suppliedDescription.length > 500)) return json({ success: false, message: "Background descriptions must be 500 characters or fewer." }, 400);
    const description = typeof suppliedDescription === "string" ? suppliedDescription.trim() : "";
    const defaultValue = formData.get("isDefault");
    const enabledValue = formData.get("enabled");
    if ((defaultValue !== null && defaultValue !== "true" && defaultValue !== "false") || (enabledValue !== null && enabledValue !== "true" && enabledValue !== "false")) return json({ success: false, message: "Background options are invalid." }, 400);
    const isDefault = defaultValue === "true";
    const enabled = enabledValue !== "false";

    uploadedPath = `backgrounds/${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabaseAdmin.storage.from("portfolio-backgrounds").upload(uploadedPath, await file.arrayBuffer(), { contentType: file.type, cacheControl: "3600", upsert: false });
    if (uploadError) {
      uploadedPath = null;
      reportOperationalFailure("ADMIN_STORAGE_OPERATION_FAILED", { cause: uploadError });
      return json({ success: false, message: "The background image could not be uploaded." }, 502);
    }

    const { data: publicUrl } = supabaseAdmin.storage.from("portfolio-backgrounds").getPublicUrl(uploadedPath);
    const actor = await resolveAdminAuditActor();
    const background = await prisma.$transaction(async (tx) => {
      await lockBackgroundOptionWrites(tx);
      if (isDefault) await tx.backgroundOption.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      const created = await tx.backgroundOption.create({ data: { name, type: "IMAGE", value: publicUrl.publicUrl, description: description || null, enabled, isDefault } });
      await writeAdminAudit(actor, { action: "ADMIN_BACKGROUND_MEDIA_UPLOADED", targetType: "BackgroundOption", targetId: created.id, metadata: { changedFields: ["uploadedImage", "enabled", "isDefault"] }, reason: "ADMIN_REQUEST", outcome: "SUCCEEDED" }, tx);
      return created;
    });

    uploadedPath = null;
    return json({ success: true, url: publicUrl.publicUrl, background }, 201);
  } catch (cause) {
    if (uploadedPath) {
      try {
        const { error } = await supabaseAdmin.storage.from("portfolio-backgrounds").remove([uploadedPath]);
        if (error) reportOperationalFailure("ADMIN_STORAGE_OPERATION_FAILED", { cause: error });
      } catch (cleanupCause) {
        reportOperationalFailure("ADMIN_STORAGE_OPERATION_FAILED", { cause: cleanupCause });
      }
    }
    reportOperationalFailure("ADMIN_STORAGE_OPERATION_FAILED", { cause });
    return json({ success: false, message: "Upload could not be added to the shared background library." }, 503);
  }
}
