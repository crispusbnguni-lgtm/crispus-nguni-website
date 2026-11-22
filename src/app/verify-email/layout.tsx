import type { ReactNode } from "react";
import WelcomeAuthBackground from "@/components/auth/WelcomeAuthBackground";
import { getWelcomeBackgroundSettings } from "@/lib/welcome-page-background";
export const dynamic = "force-dynamic";
export default async function VerificationLayout({
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
