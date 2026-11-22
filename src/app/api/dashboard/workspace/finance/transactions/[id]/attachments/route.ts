import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, requireSameOriginApiRequest } from "@/lib/authorization";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
async function workspaceFor(userId: string) { return prisma.personalWorkspace.upsert({ where: { userId }, create: { userId }, update: {}, select: { id: true } }); }

export async function POST(request: Request, context: Context) {
  const originFailure = requireSameOriginApiRequest(request); if (originFailure) return originFailure;
  const auth = await requireApiUser(); if (auth.response) return auth.response;
  const { id } = await context.params;
  let input: unknown; try { input = await request.json(); } catch { return json({ success: false, message: "Invalid request body." }, 400); }
  if (!record(input) || Object.keys(input).length !== 1 || typeof input.assetId !== "string" || input.assetId.length > 128) return json({ success: false, message: "Private media asset was not found." }, 404);
  try {
    const workspace = await workspaceFor(auth.user.id);
    const attachment = await prisma.$transaction(async (tx) => {
      const transaction = await tx.workspaceFinanceTransaction.findFirst({ where: { id, workspaceId: workspace.id, deletedAt: null }, select: { id: true } });
      const asset = await tx.workspaceMediaAsset.findFirst({ where: { id: input.assetId as string, workspaceId: workspace.id }, select: { id: true, mimeType: true, byteSize: true } });
      if (!transaction || !asset) return null;
      const link = await tx.workspaceFinanceAttachment.create({ data: { workspaceId: workspace.id, transactionId: transaction.id, mediaAssetId: asset.id }, select: { id: true, mediaAsset: { select: { id: true, mimeType: true, byteSize: true } } } });
      await tx.workspaceFinanceEvent.create({ data: { workspaceId: workspace.id, action: "ATTACHMENT_LINKED", targetType: "TRANSACTION", targetId: transaction.id, changedFields: ["attachments"] } });
      return link;
    });
    return attachment ? json({ success: true, data: attachment }, 201) : json({ success: false, message: "Transaction or private media asset was not found." }, 404);
  } catch { return json({ success: false, message: "Attachment could not be linked. It may already be attached." }, 409); }
}

export async function DELETE(request: Request, context: Context) {
  const originFailure = requireSameOriginApiRequest(request); if (originFailure) return originFailure;
  const auth = await requireApiUser(); if (auth.response) return auth.response;
  const { id } = await context.params;
  let input: unknown; try { input = await request.json(); } catch { return json({ success: false, message: "Invalid request body." }, 400); }
  if (!record(input) || Object.keys(input).length !== 1 || typeof input.assetId !== "string") return json({ success: false, message: "Attachment was not found." }, 404);
  try {
    const workspace = await workspaceFor(auth.user.id);
    const removed = await prisma.$transaction(async (tx) => {
      const result = await tx.workspaceFinanceAttachment.deleteMany({ where: { workspaceId: workspace.id, transactionId: id, mediaAssetId: input.assetId as string } });
      if (result.count) await tx.workspaceFinanceEvent.create({ data: { workspaceId: workspace.id, action: "ATTACHMENT_UNLINKED", targetType: "TRANSACTION", targetId: id, changedFields: ["attachments"] } });
      return result.count;
    });
    return removed ? json({ success: true }) : json({ success: false, message: "Attachment was not found." }, 404);
  } catch { return json({ success: false, message: "Attachment could not be removed." }, 503); }
}
