import { pageArchive } from "@/lib/personal-workspace-route-handlers";

export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ pageId: string }> }) { return pageArchive(request, context, "restore"); }
