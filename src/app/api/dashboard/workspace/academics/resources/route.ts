import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, requireSameOriginApiRequest } from "@/lib/authorization";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers }); }
async function readBody(request: Request, limit: number) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > limit) return null;
  if (!request.body) return "";
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel(); return null; } chunks.push(value); } }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return null; }
}

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId");
  const query = url.searchParams.get("q")?.trim().slice(0, 120);
  if (Array.from(url.searchParams.keys()).some((key) => !["courseId", "q"].includes(key))) return json({ success: false, message: "Unsupported search parameter." }, 400);
  try {
    const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: auth.user.id }, select: { id: true } });
    if (!workspace) return json({ success: true, resources: [] });
    const resources = await prisma.academicKnowledgeResource.findMany({
      where: { workspaceId: workspace.id, ...(courseId ? { courseId } : {}), ...(query ? { OR: [{ title: { contains: query, mode: "insensitive" } }, { topic: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }, { searchableText: { contains: query, mode: "insensitive" } }] } : {}) },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: 100,
      select: { id: true, courseId: true, mediaAssetId: true, title: true, topic: true, description: true, searchableText: true, createdAt: true, course: { select: { name: true, code: true } }, mediaAsset: { select: { mimeType: true, byteSize: true } } },
    });
    return json({ success: true, resources: resources.map((item) => ({ id: item.id, courseId: item.courseId, mediaAssetId: item.mediaAssetId, title: item.title, topic: item.topic, description: item.description, createdAt: item.createdAt, course: item.course, mediaAsset: item.mediaAsset, downloadUrl: `/api/dashboard/workspace/media/${encodeURIComponent(item.mediaAssetId)}` })) });
  } catch { return json({ success: false, message: "Academic resources are temporarily unavailable." }, 503); }
}

export async function POST(request: Request) {
  const originFailure = requireSameOriginApiRequest(request);
  if (originFailure) return originFailure;
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  let input: unknown;
  try { const body = await readBody(request, 140_000); if (body === null) return json({ success: false, message: "Resource details are too large." }, 413); input = JSON.parse(body); } catch { return json({ success: false, message: "Invalid JSON request." }, 400); }
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype) return json({ success: false, message: "Invalid resource details." }, 400);
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !["courseId", "mediaAssetId", "title", "topic", "description", "searchableText"].includes(key))) return json({ success: false, message: "Unsupported resource field." }, 400);
  const { courseId, mediaAssetId, title, topic, description, searchableText } = value;
  if (typeof courseId !== "string" || typeof mediaAssetId !== "string" || typeof title !== "string" || !title.trim() || title.length > 180 || (topic !== undefined && topic !== null && (typeof topic !== "string" || topic.length > 160)) || (description !== undefined && description !== null && (typeof description !== "string" || description.length > 2000)) || (searchableText !== undefined && searchableText !== null && (typeof searchableText !== "string" || searchableText.length > 100_000))) return json({ success: false, message: "Resource details are invalid or exceed their limits." }, 400);
  try {
    const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: auth.user.id }, select: { id: true } });
    if (!workspace) return json({ success: false, message: "Workspace is unavailable." }, 404);
    const [course, asset] = await Promise.all([
      prisma.academicCourse.findFirst({ where: { id: courseId, workspaceId: workspace.id, archivedAt: null }, select: { id: true } }),
      prisma.workspaceMediaAsset.findFirst({ where: { id: mediaAssetId, workspaceId: workspace.id, mimeType: "application/pdf" }, select: { id: true } }),
    ]);
    if (!course || !asset) return json({ success: false, message: "Course or private PDF was not found in this workspace." }, 404);
    const resource = await prisma.academicKnowledgeResource.create({ data: { workspaceId: workspace.id, courseId, mediaAssetId, title: title.trim(), topic: typeof topic === "string" ? topic.trim() || null : null, description: typeof description === "string" ? description.trim() || null : null, searchableText: typeof searchableText === "string" ? searchableText.trim() || null : null }, select: { id: true, courseId: true, mediaAssetId: true, title: true, topic: true, description: true, createdAt: true } });
    return json({ success: true, resource: { ...resource, downloadUrl: `/api/dashboard/workspace/media/${encodeURIComponent(resource.mediaAssetId)}` } }, 201);
  } catch { return json({ success: false, message: "Resource could not be saved; the PDF may already be in this library." }, 409); }
}
