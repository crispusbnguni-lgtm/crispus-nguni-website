import { getAcademicResource, postAcademicResource } from "@/lib/personal-workspace-academics-routes";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ resource: string }> };
export function GET(request: Request, context: Context) { return getAcademicResource(request, context); }
export function POST(request: Request, context: Context) { return postAcademicResource(request, context); }
