import { deleteAcademicResource, patchAcademicResource } from "@/lib/personal-workspace-academics-routes";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ resource: string; id: string }> };
export function PATCH(request: Request, context: Context) { return patchAcademicResource(request, context); }
export function DELETE(request: Request, context: Context) { return deleteAcademicResource(request, context); }
