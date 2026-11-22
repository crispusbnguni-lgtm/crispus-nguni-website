import { requireUser } from "@/lib/authorization";
import { AcademicPlanner } from "@/components/workspace/AcademicPlanner";

export const dynamic = "force-dynamic";

export default async function AcademicWorkspacePage() {
  await requireUser();
  return <AcademicPlanner section="assignments" />;
}
