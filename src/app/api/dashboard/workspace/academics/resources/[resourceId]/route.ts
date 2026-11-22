import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, requireSameOriginApiRequest } from "@/lib/authorization";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
export async function DELETE(request: Request, context: { params: Promise<{ resourceId: string }> }) {
  const originFailure = requireSameOriginApiRequest(request);
  if (originFailure) return originFailure;
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { resourceId } = await context.params;
  try {
    const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: auth.user.id }, select: { id: true } });
    if (!workspace) return NextResponse.json({ success: false, message: "Resource was not found." }, { status: 404, headers });
    const deleted = await prisma.academicKnowledgeResource.deleteMany({ where: { id: resourceId, workspaceId: workspace.id } });
    if (deleted.count !== 1) return NextResponse.json({ success: false, message: "Resource was not found." }, { status: 404, headers });
    return NextResponse.json({ success: true }, { headers });
  } catch { return NextResponse.json({ success: false, message: "Resource could not be removed." }, { status: 503, headers }); }
}
