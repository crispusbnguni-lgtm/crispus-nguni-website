import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, requireSameOriginApiRequest } from "@/lib/authorization";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hasAllowedBackgroundMediaSignature } from "@/lib/background-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_MULTIPART_SIZE = MAX_IMAGE_SIZE + 64 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
type Context = { params: Promise<{ assetId: string }> };
function response(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: NO_STORE }); }
function oversizedRequest(request: Request) {
  const length = request.headers.get("content-length");
  return length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_MULTIPART_SIZE);
}
async function privateBucket() {
  try {
    const name = process.env.WORKSPACE_PRIVATE_MEDIA_BUCKET;
    if (!name || !/^[a-zA-Z0-9._-]{3,100}$/.test(name)) return null;
    const { data, error } = await supabaseAdmin.storage.getBucket(name);
    return !error && data && !data.public ? name : null;
  } catch { return null; }
}
async function validUpload(request: Request) {
  if (oversizedRequest(request)) return { error: response({ success: false, message: "Images must be 5 MB or smaller." }, 413) } as const;
  let form: FormData;
  try { form = await request.formData(); } catch { return { error: response({ success: false, message: "Choose a valid image file." }, 400) } as const; }
  const file = form.get("file");
  if (!(file instanceof File)) return { error: response({ success: false, message: "Choose an image file." }, 400) } as const;
  const extension = TYPES[file.type];
  if (!extension) return { error: response({ success: false, message: "Choose a JPG, PNG, or WebP image." }, 415) } as const;
  if (file.size < 1 || file.size > MAX_IMAGE_SIZE) return { error: response({ success: false, message: "Images must be 5 MB or smaller." }, 413) } as const;
  if (!await hasAllowedBackgroundMediaSignature(file, Object.keys(TYPES))) return { error: response({ success: false, message: "The file contents do not match its image type." }, 415) } as const;
  return { file, extension } as const;
}

export async function GET(_request: Request, context: Context) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { assetId } = await context.params;
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(assetId)) return response({ success: false }, 404);
  try {
    const asset = await prisma.workspaceMediaAsset.findFirst({ where: { id: assetId, workspace: { userId: auth.user.id } }, select: { objectKey: true, mimeType: true } });
    if (!asset || !Object.hasOwn(TYPES, asset.mimeType)) return response({ success: false }, 404);
    const bucket = await privateBucket();
    if (!bucket) return response({ success: false, message: "Private media storage is unavailable." }, 503);
    const { data, error } = await supabaseAdmin.storage.from(bucket).download(asset.objectKey);
    if (error || !data) return response({ success: false, message: "Private media is unavailable." }, 404);
    return new Response(data, { headers: { ...NO_STORE, "Content-Type": asset.mimeType, "Content-Disposition": asset.mimeType === "application/pdf" ? "attachment; filename=academic-resource.pdf" : "inline" } });
  } catch { return response({ success: false, message: "Private media is temporarily unavailable." }, 503); }
}

export async function PUT(request: Request, context: Context) {
  const originFailure = requireSameOriginApiRequest(request);
  if (originFailure) return originFailure;
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { assetId } = await context.params;
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(assetId)) return response({ success: false, message: "Asset was not found." }, 404);
  const bucket = await privateBucket();
  if (!bucket) return response({ success: false, message: "Private media storage is not configured or is not private." }, 503);
  const upload = await validUpload(request);
  if ("error" in upload) return upload.error;
  let newKey: string | null = null;
  try {
    const existing = await prisma.workspaceMediaAsset.findFirst({ where: { id: assetId, workspace: { userId: auth.user.id } }, select: { id: true, workspaceId: true, objectKey: true } });
    if (!existing) return response({ success: false, message: "Asset was not found." }, 404);
    newKey = `${existing.workspaceId}/${randomUUID()}.${upload.extension}`;
    const stored = await supabaseAdmin.storage.from(bucket).upload(newKey, await upload.file.arrayBuffer(), { contentType: upload.file.type, cacheControl: "3600", upsert: false });
    if (stored.error) return response({ success: false, message: "Replacement upload failed." }, 502);
    const updated = await prisma.workspaceMediaAsset.updateMany({ where: { id: assetId, workspaceId: existing.workspaceId, objectKey: existing.objectKey }, data: { objectKey: newKey, mimeType: upload.file.type, byteSize: upload.file.size, width: null, height: null } });
    if (updated.count !== 1) {
      await supabaseAdmin.storage.from(bucket).remove([newKey]);
      return response({ success: false, message: "Asset changed concurrently. Refresh the library and retry." }, 409);
    }
    let cleanupPending = false;
    const removed = await supabaseAdmin.storage.from(bucket).remove([existing.objectKey]);
    if (removed.error) cleanupPending = true;
    return response({ success: true, replaced: true, storageCleanupPending: cleanupPending });
  } catch {
    if (newKey) { try { await supabaseAdmin.storage.from(bucket).remove([newKey]); } catch { /* New object remains private and unreferenced. */ } }
    return response({ success: false, message: "Asset replacement could not be completed." }, 503);
  }
}

export async function DELETE(request: Request, context: Context) {
  const originFailure = requireSameOriginApiRequest(request);
  if (originFailure) return originFailure;
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { assetId } = await context.params;
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(assetId)) return response({ success: false, message: "Asset was not found." }, 404);
  const bucket = await privateBucket();
  if (!bucket) return response({ success: false, message: "Private media storage is unavailable." }, 503);
  try {
    const existing = await prisma.workspaceMediaAsset.findFirst({ where: { id: assetId, workspace: { userId: auth.user.id } }, select: { id: true, workspaceId: true, objectKey: true, _count: { select: { coverPages: true, blocks: true, financeAttachments: true, academicResources: true, nutritionFoodImages: true, nutritionMealPhotos: true } } } });
    if (!existing) return response({ success: false, message: "Asset was not found." }, 404);
    if (existing._count.coverPages || existing._count.blocks || existing._count.financeAttachments || existing._count.academicResources || existing._count.nutritionFoodImages || existing._count.nutritionMealPhotos) return response({ success: false, message: "This file is still referenced by workspace content. Remove its resource reference first." }, 409);
    await prisma.workspaceMediaAsset.delete({ where: { workspaceId_id: { workspaceId: existing.workspaceId, id: existing.id } } });
    const removed = await supabaseAdmin.storage.from(bucket).remove([existing.objectKey]);
    return response({ success: true, deleted: true, storageCleanupPending: Boolean(removed.error) });
  } catch {
    return response({ success: false, message: "Asset could not be deleted. It may still be referenced by workspace content." }, 409);
  }
}
