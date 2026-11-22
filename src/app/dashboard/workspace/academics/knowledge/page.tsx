import { requireUser } from "@/lib/authorization";
import { AcademicKnowledgeCentre } from "@/components/workspace/AcademicKnowledgeCentre";

export const dynamic = "force-dynamic";
export default async function AcademicKnowledgePage() {
  await requireUser();
  return <AcademicKnowledgeCentre/>;
}
