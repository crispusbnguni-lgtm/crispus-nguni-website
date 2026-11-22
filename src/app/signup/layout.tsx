
import type { ReactNode } from "react";
import WelcomeAuthBackground from "@/components/auth/WelcomeAuthBackground";
import { Navbar } from "@/components/navigation/Navbar";
import { getWelcomeBackgroundSettings } from "@/lib/welcome-page-background";
export const dynamic = "force-dynamic";
export default async function SignupLayout({
  children,
}: {
  children: ReactNode;
}) {
  const background = await getWelcomeBackgroundSettings();

  return (
    <div
      className="crispus-public-page crispus-public-auth relative isolate min-h-screen"
      style={{ backgroundColor: "var(--bg)" }}
    >
      <WelcomeAuthBackground
        backgroundImage={background.backgroundImage}
        backgroundColor={background.backgroundColor}
        backgroundPosition={background.backgroundPosition}
      />

      <Navbar />
      <div className="relative z-10 pt-[92px] sm:pt-[100px] lg:pt-0">{children}</div>
    </div>
  );
}
