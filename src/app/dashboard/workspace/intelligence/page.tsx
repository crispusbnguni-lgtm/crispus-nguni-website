import { requireUser } from "@/lib/authorization";
import { PersonalIntelligenceCentre } from "@/components/workspace/PersonalIntelligenceCentre";

export const dynamic = "force-dynamic";

export default async function PersonalIntelligencePage() {
  await requireUser();
  return <PersonalIntelligenceCentre />;
}
