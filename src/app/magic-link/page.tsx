import type { Metadata } from "next";
import MagicLinkClient from "./MagicLinkClient";

export const metadata: Metadata = {
  title: "Secure sign-in | Crispus Nguni",
  description: "Complete your secure account sign-in.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  referrer: "no-referrer",
};

export default async function MagicLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token =
    typeof params.token === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(params.token)
      ? params.token
      : "";

  return <MagicLinkClient token={token} />;
}