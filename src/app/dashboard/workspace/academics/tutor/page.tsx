import { requireUser } from "@/lib/authorization";
import { AcademicTutor } from "@/components/workspace/AcademicTutor";

export const dynamic = "force-dynamic";
export default async function AcademicTutorPage() {
  await requireUser();
  return <AcademicTutor/>;
}
