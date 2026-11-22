import { requireUser } from "@/lib/authorization";
import { WorkspaceProjectDetail } from "@/components/workspace/WorkspaceProjectDetail";

export const dynamic = "force-dynamic";

export default async function WorkspaceProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  await requireUser();
  const { projectId } = await params;
  return <WorkspaceProjectDetail projectId={projectId} />;
}
