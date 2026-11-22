import { changeAcademicActivityLink } from "@/lib/personal-workspace-academics-routes";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export function POST(request: Request, context: Context) { return changeAcademicActivityLink(request, context, true); }
export function DELETE(request: Request, context: Context) { return changeAcademicActivityLink(request, context, false); }
