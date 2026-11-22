import { requireUser } from "@/lib/authorization";
import { WorkspaceCalendar } from "@/components/workspace/WorkspaceCalendar";

export const dynamic = "force-dynamic";

export default async function PersonalWorkspaceCalendarPage() {
  await requireUser();
  return <WorkspaceCalendar />;
}
