import { PublicCmsPage } from "@/components/public-site/PublicCmsPage";
import { publicPageMetadata } from "@/lib/public-page-data";

export const dynamic = "force-dynamic";
export async function generateMetadata() { return publicPageMetadata("about"); }
export default function AboutPage() { return <PublicCmsPage pageKey="about" />; }
