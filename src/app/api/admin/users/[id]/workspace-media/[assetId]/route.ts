import { NextResponse } from "next/server";
import { requireApiSuperAdmin } from "@/lib/authorization";
import { resolveAdminAuditActor, writeAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
const json = (message: string, status: number) => NextResponse.json({ success: false, message }, { status, headers: NO_STORE });
type Context = { params: Promise<{ id: string; assetId: string }> };

export async function GET(_request: Request, context: Context) {
  const authorization = await requireApiSuperAdmin();
  if (authorization.response) return authorization.response;
  const { id, assetId } = await context.params;
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(assetId)) return json("Media asset was not found.", 404);

  try {
    const asset = await prisma.workspaceMediaAsset.findFirst({ where: { id: assetId, mimeType: { in: ["image/jpeg", "image/png", "image/webp", "application/pdf"] }, workspace: { userId: id } }, select: { id: true, workspaceId: true, objectKey: true, mimeType: true } });
    if (!asset) return json("Media asset was not found.", 404);

    const actor = await resolveAdminAuditActor();
    await writeAdminAudit(actor, { action: "ADMIN_ACCOUNT_VIEWED", targetType: "User", targetId: id, metadata: { changedFields: ["workspaceMedia"] }, reason: "ADMIN_REQUEST", outcome: "SUCCEEDED" });

    const bucketName = process.env.WORKSPACE_PRIVATE_MEDIA_BUCKET;
    if (!bucketName || !/^[a-zA-Z0-9._-]{3,100}$/.test(bucketName)) return json("Private workspace media is unavailable.", 503);
    const { data: bucket, error: bucketError } = await supabaseAdmin.storage.getBucket(bucketName);
    if (bucketError || !bucket || bucket.public) return json("Private workspace media is unavailable.", 503);
    const { data, error } = await supabaseAdmin.storage.from(bucketName).download(asset.objectKey);
    if (error || !data) return json("Private workspace media is unavailable.", 404);
    return new Response(data, { headers: { ...NO_STORE, "Content-Type": asset.mimeType, "Content-Disposition": asset.mimeType === "application/pdf" ? "attachment; filename=workspace-resource.pdf" : "inline" } });
  } catch {
    return json("Workspace media is temporarily unavailable.", 503);
  }
}
