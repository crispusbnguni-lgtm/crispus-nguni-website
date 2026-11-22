import { deleteTimetableExceptionRoute } from "@/lib/personal-workspace-academics-routes";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; occurrenceOn: string }> };
export function DELETE(request: Request, context: Context) { return deleteTimetableExceptionRoute(request, context); }
