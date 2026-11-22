import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, requireSameOriginApiRequest } from "@/lib/authorization";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const MAX_BODY_BYTES = 4_096;
const MAX_MEMORIES = 100;
const KINDS = ["PREFERENCE", "GOAL", "CONTEXT"] as const;
type MemoryKind = (typeof KINDS)[number];

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const length = request.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > MAX_BODY_BYTES) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (typeof value !== "object" || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return null;
  return value as Record<string, unknown>;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ");
  return text.length > 0 && text.length <= max ? text : null;
}

function parseKind(value: unknown): MemoryKind | null {
  return typeof value === "string" && KINDS.includes(value as MemoryKind) ? value as MemoryKind : null;
}

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  try {
    const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: auth.user.id }, select: { id: true } });
    if (!workspace) return json({ success: true, memories: [] });
    const memories = await prisma.workspaceIntelligenceMemory.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: MAX_MEMORIES,
      select: { id: true, kind: true, label: true, content: true, enabled: true, createdAt: true, updatedAt: true },
    });
    return json({ success: true, memories });
  } catch {
    return json({ success: false, message: "Private memory is temporarily unavailable." }, 503);
  }
}

export async function POST(request: Request) {
  const originFailure = requireSameOriginApiRequest(request);
  if (originFailure) return originFailure;
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  let body: Record<string, unknown> | null;
  try { body = await readBody(request); } catch { return json({ success: false, message: "Invalid memory entry." }, 400); }
  if (!body) return json({ success: false, message: "Memory entry is empty or too large." }, 413);
  if (Object.keys(body).some((key) => !["kind", "label", "content"].includes(key)) || Object.keys(body).length !== 3) return json({ success: false, message: "Unsupported memory fields." }, 400);
  const kind = parseKind(body.kind);
  const label = cleanText(body.label, 80);
  const content = cleanText(body.content, 500);
  if (!kind || !label || !content) return json({ success: false, message: "Choose a valid type, short label and memory of 500 characters or fewer." }, 400);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const workspace = await tx.personalWorkspace.upsert({ where: { userId: auth.user.id }, create: { userId: auth.user.id }, update: {}, select: { id: true } });
      const count = await tx.workspaceIntelligenceMemory.count({ where: { workspaceId: workspace.id } });
      if (count >= MAX_MEMORIES) return null;
      return tx.workspaceIntelligenceMemory.create({
        data: { workspaceId: workspace.id, kind, label, content, enabled: false },
        select: { id: true, kind: true, label: true, content: true, enabled: true, createdAt: true, updatedAt: true },
      });
    }, { isolationLevel: "Serializable" });
    if (!result) return json({ success: false, message: "The private memory limit has been reached." }, 409);
    return json({ success: true, memory: result }, 201);
  } catch {
    return json({ success: false, message: "Private memory could not be saved." }, 503);
  }
}
