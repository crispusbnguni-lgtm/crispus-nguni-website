import { requireUser } from "@/lib/authorization";
import { WorkspacePagesEditor } from "@/components/workspace/WorkspacePagesEditor";
import { WorkspaceSectionNav } from "@/components/workspace/WorkspaceSectionNav";
import { WorkspacePrivateMediaLibrary } from "@/components/workspace/WorkspacePrivateMediaLibrary";

export const dynamic = "force-dynamic";

export default async function WorkspacePagesPage() {
  await requireUser();
  return <div className="grid gap-5 px-4 pb-8 pt-6 sm:px-6 lg:px-8"><div className="mx-auto w-full max-w-7xl"><WorkspaceSectionNav active="pages" /></div><WorkspacePagesEditor /><WorkspacePrivateMediaLibrary /></div>;
}
