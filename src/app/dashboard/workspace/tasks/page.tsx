import { requireUser } from "@/lib/authorization";
import { WorkspacePlanning } from "@/components/workspace/WorkspacePlanning";

export const dynamic = "force-dynamic";

export default async function WorkspaceTasksPage() {
  await requireUser();
  return <WorkspacePlanning section="tasks" />;
}
