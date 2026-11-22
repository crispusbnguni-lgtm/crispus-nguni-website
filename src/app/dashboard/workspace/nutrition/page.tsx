import { requireUser } from "@/lib/authorization";
import { WorkspaceNutrition } from "@/components/workspace/WorkspaceNutrition";

export const dynamic = "force-dynamic";

export default async function WorkspaceNutritionPage() {
  await requireUser();
  return <WorkspaceNutrition />;
}
