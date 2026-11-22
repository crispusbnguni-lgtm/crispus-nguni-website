import { PublicCmsPage } from "@/components/public-site/PublicCmsPage";
import { publicPageMetadata } from "@/lib/public-page-data";

export const dynamic = "force-dynamic";
export async function generateMetadata() { return publicPageMetadata("services"); }
export default function ServicesPage() { return <PublicCmsPage pageKey="services" />; }
