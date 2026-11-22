import type { Metadata } from "next";
import type { ReactNode } from "react";
import WelcomeAuthBackground from "@/components/auth/WelcomeAuthBackground";
import { getWelcomeBackgroundSettings } from "@/lib/welcome-page-background";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Reset password | Crispus.",
  description: "Choose a new password for your account.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  referrer: "no-referrer",
};

export default async function ResetPasswordLayout({
  children,
}: {
  children: ReactNode;
}) {
  const background = await getWelcomeBackgroundSettings();

  return (
    <div
      className="relative isolate min-h-screen"
      style={{ backgroundColor: background.backgroundColor }}
    >
      <WelcomeAuthBackground
        backgroundImage={background.backgroundImage}
        backgroundColor={background.backgroundColor}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
