import { requireUser } from "@/lib/authorization";
import { WorkspaceSecurity } from "@/components/workspace/WorkspaceSecurity";

export const dynamic = "force-dynamic";

export default async function WorkspaceSecurityPage() {
  await requireUser();
  return <WorkspaceSecurity />;
}
