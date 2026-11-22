import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, requireSameOriginApiRequest } from "@/lib/authorization";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const KINDS = ["PREFERENCE", "GOAL", "CONTEXT"] as const;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ");
  return text.length > 0 && text.length <= max ? text : null;
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const length = request.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > 4_096) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4_096) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { return null; }
  if (typeof value !== "object" || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return null;
  return value as Record<string, unknown>;
}

type Context = { params: Promise<{ memoryId: string }> };

export async function PATCH(request: Request, context: Context) {
  const originFailure = requireSameOriginApiRequest(request);
  if (originFailure) return originFailure;
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { memoryId } = await context.params;
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(memoryId)) return json({ success: false, message: "Memory entry was not found." }, 404);
  const body = await readBody(request);
  if (!body) return json({ success: false, message: "Invalid or oversized memory update." }, 400);
  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => !["kind", "label", "content", "enabled"].includes(key))) return json({ success: false, message: "Unsupported memory fields." }, 400);
  const data: { kind?: "PREFERENCE" | "GOAL" | "CONTEXT"; label?: string; content?: string; enabled?: boolean } = {};
  if (Object.hasOwn(body, "kind")) {
    if (typeof body.kind !== "string" || !KINDS.includes(body.kind as typeof KINDS[number])) return json({ success: false, message: "Invalid memory type." }, 400);
    data.kind = body.kind as typeof KINDS[number];
  }
  if (Object.hasOwn(body, "label")) {
    const label = cleanText(body.label, 80);
    if (!label) return json({ success: false, message: "Memory label is invalid." }, 400);
    data.label = label;
  }
  if (Object.hasOwn(body, "content")) {
    const content = cleanText(body.content, 500);
    if (!content) return json({ success: false, message: "Memory content is invalid." }, 400);
    data.content = content;
  }
  if (Object.hasOwn(body, "enabled")) {
    if (typeof body.enabled !== "boolean") return json({ success: false, message: "Memory consent must be enabled or disabled." }, 400);
    data.enabled = body.enabled;
  }
  try {
    const result = await prisma.workspaceIntelligenceMemory.updateMany({ where: { id: memoryId, workspace: { userId: auth.user.id } }, data });
    if (result.count !== 1) return json({ success: false, message: "Memory entry was not found." }, 404);
    const memory = await prisma.workspaceIntelligenceMemory.findFirst({
      where: { id: memoryId, workspace: { userId: auth.user.id } },
      select: { id: true, kind: true, label: true, content: true, enabled: true, createdAt: true, updatedAt: true },
    });
    if (!memory) return json({ success: false, message: "Memory entry was not found." }, 404);
    return json({ success: true, memory });
  } catch {
    return json({ success: false, message: "Private memory could not be updated." }, 503);
  }
}

export async function DELETE(request: Request, context: Context) {
  const originFailure = requireSameOriginApiRequest(request);
  if (originFailure) return originFailure;
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { memoryId } = await context.params;
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(memoryId)) return json({ success: false, message: "Memory entry was not found." }, 404);
  try {
    const result = await prisma.workspaceIntelligenceMemory.deleteMany({ where: { id: memoryId, workspace: { userId: auth.user.id } } });
    if (result.count !== 1) return json({ success: false, message: "Memory entry was not found." }, 404);
    return json({ success: true, deleted: true });
  } catch {
    return json({ success: false, message: "Private memory could not be deleted." }, 503);
  }
}
