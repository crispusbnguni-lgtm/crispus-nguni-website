import { postTimetableException } from "@/lib/personal-workspace-academics-routes";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export function POST(request: Request, context: Context) { return postTimetableException(request, context); }
