import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { reportOperationalFailure } from "@/lib/observability";
import { resolvePublicSiteBaseUrl } from "@/lib/portfolio-public";
import { resolveWelcomePageBackground } from "@/lib/welcome-page";
import {
  DEFAULT_PUBLIC_SITE_PAGES,
  getPublicSitePageContent,
  type PublicSitePageContent,
  type PublicSitePageKey,
} from "@/lib/public-site-pages";

export async function loadPublicPage(key: PublicSitePageKey): Promise<{
  content: PublicSitePageContent;
  backgroundImage: string;
  backgroundPosition: string;
  backgroundColor: string;
}> {
  let stored: unknown = null;
  try {
    const settings = await prisma.welcomePageSettings.findUnique({ where: { key: "main" } });
    stored = settings?.content;
  } catch (error) {
    reportOperationalFailure("WELCOME_PAGE_CONTENT_READ_FAILED", { cause: error });
  }

  const content = getPublicSitePageContent(stored, key);
  const background = resolveWelcomePageBackground(stored, false);
  return {
    content,
    backgroundImage: content.backgroundImage || background.backgroundImage,
    backgroundPosition: content.backgroundPosition || background.backgroundPosition,
    backgroundColor: background.backgroundColor,
  };
}

export async function publicPageMetadata(key: PublicSitePageKey): Promise<Metadata> {
  const { content } = await loadPublicPage(key);
  const baseUrl = resolvePublicSiteBaseUrl();
  const canonical = `${baseUrl}/${key}`;
  return {
    title: content.metaTitle,
    description: content.metaDescription,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: content.metaTitle,
      description: content.metaDescription,
      url: canonical,
      images: content.socialImage ? [content.socialImage] : [],
    },
    twitter: {
      card: content.socialImage ? "summary_large_image" : "summary",
      title: content.metaTitle,
      description: content.metaDescription,
      images: content.socialImage ? [content.socialImage] : [],
    },
  };
}

export function defaultPageContent(key: PublicSitePageKey) {
  return DEFAULT_PUBLIC_SITE_PAGES[key];
}
