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
const MAX_PDF_SIZE = 15 * 1024 * 1024;
const MAX_MULTIPART_SIZE = MAX_PDF_SIZE + 64 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

function response(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: NO_STORE }); }
function oversizedRequest(request: Request) {
  const length = request.headers.get("content-length");
  return length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_MULTIPART_SIZE);
}

async function privateBucket() {
  try {
    const bucketName = process.env.WORKSPACE_PRIVATE_MEDIA_BUCKET;
    if (!bucketName || !/^[a-zA-Z0-9._-]{3,100}$/.test(bucketName)) return null;
    const { data, error } = await supabaseAdmin.storage.getBucket(bucketName);
    if (error || !data || data.public) return null;
    return bucketName;
  } catch { return null; }
}

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  try {
    const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: auth.user.id }, select: { id: true } });
    if (!workspace) return response({ success: true, assets: [] });
    const assets = await prisma.workspaceMediaAsset.findMany({ where: { workspaceId: workspace.id, mimeType: { startsWith: "image/" } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 100, select: { id: true, mimeType: true, byteSize: true, width: true, height: true, createdAt: true } });
    return response({ success: true, assets: assets.map((asset) => ({ ...asset, src: `/api/dashboard/workspace/media/${encodeURIComponent(asset.id)}` })) });
  } catch {
    return response({ success: false, message: "Private workspace media is temporarily unavailable." }, 503);
  }
}

export async function POST(request: Request) {
  const originFailure = requireSameOriginApiRequest(request);
  if (originFailure) return originFailure;
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (oversizedRequest(request)) return response({ success: false, message: "Files must be 15 MB or smaller." }, 413);
  const bucket = await privateBucket();
  if (!bucket) return response({ success: false, message: "Private media storage is not configured or is not private." }, 503);
  let form: FormData;
  try { form = await request.formData(); } catch { return response({ success: false, message: "Choose a valid image file." }, 400); }
  const file = form.get("file");
  if (!(file instanceof File)) return response({ success: false, message: "Choose an image file." }, 400);
  const extension = TYPES[file.type];
  const isPdf = file.type === "application/pdf";
  if (!extension) return response({ success: false, message: "Choose a JPG, PNG, WebP image, or PDF." }, 415);
  if (file.size < 1 || file.size > (isPdf ? MAX_PDF_SIZE : MAX_IMAGE_SIZE)) return response({ success: false, message: isPdf ? "PDFs must be 15 MB or smaller." : "Images must be 5 MB or smaller." }, 413);
  const signatureValid = isPdf ? (await file.slice(0, 5).text()) === "%PDF-" : await hasAllowedBackgroundMediaSignature(file, ["image/jpeg", "image/png", "image/webp"]);
  if (!signatureValid) return response({ success: false, message: "The file contents do not match its declared type." }, 415);
  let objectKey: string | null = null;
  try {
    const workspace = await prisma.personalWorkspace.upsert({ where: { userId: auth.user.id }, create: { userId: auth.user.id }, update: {}, select: { id: true } });
    objectKey = `${workspace.id}/${randomUUID()}.${extension}`;
    const { error } = await supabaseAdmin.storage.from(bucket).upload(objectKey, await file.arrayBuffer(), { contentType: file.type, cacheControl: "3600", upsert: false });
    if (error) return response({ success: false, message: "Private upload failed. The private storage service rejected the file." }, 502);
    const asset = await prisma.workspaceMediaAsset.create({ data: { workspaceId: workspace.id, objectKey, mimeType: file.type, byteSize: file.size }, select: { id: true, mimeType: true, byteSize: true, width: true, height: true, createdAt: true } });
    return response({ success: true, asset: { ...asset, src: `/api/dashboard/workspace/media/${encodeURIComponent(asset.id)}` } }, 201);
  } catch {
    if (objectKey) {
      try { await supabaseAdmin.storage.from(bucket).remove([objectKey]); } catch { /* Object stays private; no key is returned to the client. */ }
    }
    return response({ success: false, message: "Private upload could not be completed." }, 503);
  }
}
