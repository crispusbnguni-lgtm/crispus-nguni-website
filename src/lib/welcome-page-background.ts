
import { draftMode } from "next/headers";
import { prisma } from "@/lib/prisma";

type WelcomeBackgroundSettings = {
  backgroundImage: string;
  backgroundColor: string;
  accentColor: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

const DEFAULT_BACKGROUND: WelcomeBackgroundSettings = {
  backgroundImage: "",
  backgroundColor: "#05070D",
  accentColor: "#6366F1",
};

export async function getWelcomeBackgroundSettings(): Promise<WelcomeBackgroundSettings> {
  try {
    const draft = await draftMode();

    const settings = await prisma.welcomePageSettings.findUnique({
      where: { key: "main" },
    });

    const storedContent: unknown = settings?.content;

    if (!isRecord(storedContent)) {
      return DEFAULT_BACKGROUND;
    }

    const metadata = isRecord(storedContent.__cms)
      ? storedContent.__cms
      : {};

    let content: Record<string, unknown>;

    if (draft.isEnabled && isRecord(metadata.draft)) {
      content = metadata.draft;
    } else {
      content = {};

      for (const [key, value] of Object.entries(storedContent)) {
        if (key !== "__cms") {
          content[key] = value;
        }
      }
    }

    const hero = isRecord(content.hero) ? content.hero : {};
    const appearance = isRecord(content.appearance)
      ? content.appearance
      : {};

    return {
      backgroundImage:
        typeof hero.backgroundImage === "string"
          ? hero.backgroundImage.trim()
          : "",
      backgroundColor:
        typeof appearance.backgroundColor === "string"
          ? appearance.backgroundColor
          : DEFAULT_BACKGROUND.backgroundColor,
      accentColor:
        typeof appearance.accentColor === "string"
          ? appearance.accentColor
          : DEFAULT_BACKGROUND.accentColor,
    };
  } catch (error) {
    console.error("Failed to load Welcome page background:", error);
    return DEFAULT_BACKGROUND;
  }
}