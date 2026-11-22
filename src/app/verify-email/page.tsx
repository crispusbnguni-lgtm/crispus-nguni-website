import type { Metadata } from "next";
import VerificationClient from "./VerificationClient";

export const metadata: Metadata = {
  title: "Verify your email | Crispus Nguni",
  description: "Securely verify your email address.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  referrer: "no-referrer",
};

export default async function VerifyEmailPage({
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

  return <VerificationClient token={token} />;
}
