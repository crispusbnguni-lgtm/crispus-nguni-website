import { draftMode } from "next/headers";
import { prisma } from "@/lib/prisma";
import { reportOperationalFailure } from "@/lib/observability";
import { resolveWelcomePageBackground, type WelcomePageBackgroundSettings } from "@/lib/welcome-page";

export type WelcomeBackgroundOptions = { publishedOnly?: boolean };

export async function getWelcomeBackgroundSettings(
  options: WelcomeBackgroundOptions = {},
): Promise<WelcomePageBackgroundSettings> {
  try {
    const settings = await prisma.welcomePageSettings.findUnique({
      where: { key: "main" },
      select: { content: true },
    });
    const previewDraft = options.publishedOnly
      ? false
      : (await draftMode()).isEnabled;
    return resolveWelcomePageBackground(settings?.content, previewDraft);
  } catch (error) {
    reportOperationalFailure("WELCOME_BACKGROUND_READ_FAILED", { cause: error });
    return resolveWelcomePageBackground(null);
  }
}
