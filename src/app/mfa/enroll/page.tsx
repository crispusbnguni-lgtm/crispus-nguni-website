
import { prisma } from "@/lib/prisma";
import { reportOperationalFailure } from "@/lib/observability";
import {
  defaultWelcomePageContent,
  resolveWelcomePageContent,
  type WelcomePageContent,
} from "@/lib/welcome-page";
import MfaEnrollmentClient from "./MfaEnrollmentClient";

export const dynamic = "force-dynamic";

async function getWelcomePageContent(): Promise<WelcomePageContent> {
  try {
    const settings = await prisma.welcomePageSettings.findUnique({
      where: { key: "main" },
    });

    return resolveWelcomePageContent(settings?.content, false);
  } catch (error) {
    reportOperationalFailure("WELCOME_PAGE_CONTENT_READ_FAILED", {
  cause: error,
});

    return defaultWelcomePageContent;
  }
}

export default async function MfaEnrollmentPage() {
  const content = await getWelcomePageContent();

  return (
    <MfaEnrollmentClient
      backgroundImage={String(content.hero.backgroundImage ?? "")}
      backgroundColor={content.appearance.backgroundColor || "#05070D"}
      backgroundPosition={content.hero.backgroundPosition}
    />
  );
}
