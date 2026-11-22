import { redirect } from "next/navigation";

/** The old standalone Insights index is retired; portfolio insight content remains. */
export default function RetiredInsightsIndex() {
  redirect("/explore");
}
