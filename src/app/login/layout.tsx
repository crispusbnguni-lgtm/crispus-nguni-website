
import type { ReactNode } from "react";
import WelcomeAuthBackground from "@/components/auth/WelcomeAuthBackground";
import { getWelcomeBackgroundSettings } from "@/lib/welcome-page-background";

export default async function LoginLayout({
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