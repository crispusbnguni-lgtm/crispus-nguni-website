import { requireUser } from "@/lib/authorization";
import { WorkspaceFinance } from "@/components/workspace/WorkspaceFinance";

export const dynamic = "force-dynamic";

export default async function WorkspaceFinancePage() {
  await requireUser();
  return <WorkspaceFinance />;
}
