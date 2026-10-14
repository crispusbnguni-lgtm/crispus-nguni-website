
import { draftMode } from "next/headers";

import { prisma } from "@/lib/prisma";
import {
  defaultWelcomePageContent,
  type WelcomePageContent,
} from "@/lib/welcome-page";
import WelcomePageView from "@/components/welcome-page/WelcomePageView";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

async function getWelcomePageContent(): Promise<WelcomePageContent> {
  try {
    const draft = await draftMode();

    const settings = await prisma.welcomePageSettings.findUnique({
      where: { key: "main" },
    });

    const storedContent: unknown = settings?.content;

    if (!isRecord(storedContent)) {
      return defaultWelcomePageContent;
    }

    const metadata = isRecord(storedContent.__cms)
      ? storedContent.__cms
      : {};

    if (draft.isEnabled && isRecord(metadata.draft)) {
      return metadata.draft as unknown as WelcomePageContent;
    }

    const publishedContent: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(storedContent)) {
      if (key !== "__cms") {
        publishedContent[key] = value;
      }
    }

    if (Object.keys(publishedContent).length > 0) {
      return publishedContent as unknown as WelcomePageContent;
    }
  } catch (error) {
    console.error(
      "Failed to load public welcome page settings:",
      error
    );
  }

  return defaultWelcomePageContent;
}

export default async function HomePage() {
  const content = await getWelcomePageContent();

  return <WelcomePageView content={content} />;
}