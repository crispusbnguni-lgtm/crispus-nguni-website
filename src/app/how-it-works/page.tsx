import { PublicCmsPage } from "@/components/public-site/PublicCmsPage";
import { publicPageMetadata } from "@/lib/public-page-data";

export const dynamic = "force-dynamic";
export async function generateMetadata() { return publicPageMetadata("how-it-works"); }
export default function HowItWorksPage() { return <PublicCmsPage pageKey="how-it-works" />; }
