
import { draftMode } from "next/headers";
import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { reportOperationalFailure } from "@/lib/observability";
import {
  defaultWelcomePageContent,
  resolveWelcomePageContent,
  type WelcomePageContent,
} from "@/lib/welcome-page";
import WelcomePageView from "@/components/welcome-page/WelcomePageView";

export const dynamic = "force-dynamic";

async function getWelcomePageContent(): Promise<WelcomePageContent> {
  try {
    const draft = await draftMode();
    const settings = await prisma.welcomePageSettings.findUnique({
      where: { key: "main" },
    });
    return resolveWelcomePageContent(settings?.content, draft.isEnabled);
  } catch (error) {
    reportOperationalFailure("WELCOME_PAGE_CONTENT_READ_FAILED", { cause: error });
  }

  return defaultWelcomePageContent;
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await prisma.welcomePageSettings.findUnique({
      where: { key: "main" },
    });
    const content = resolveWelcomePageContent(settings?.content, false);
    return {
      title: content.seo?.title || defaultWelcomePageContent.seo?.title,
      description: content.seo?.description || defaultWelcomePageContent.seo?.description,
    };
  } catch (error) {
    reportOperationalFailure("WELCOME_PAGE_METADATA_READ_FAILED", { cause: error });
    return {
      title: defaultWelcomePageContent.seo?.title,
      description: defaultWelcomePageContent.seo?.description,
    };
  }
}

export default async function HomePage() {
  const content = await getWelcomePageContent();

  return <WelcomePageView content={content} />;
}
