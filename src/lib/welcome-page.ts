export type WelcomePageGlassSettings = {
  enabled: boolean;
  strength: number;
  frost: number;
  transparency: number;
  reflection: number;
  depth: number;
  radius: number;
};

export type WelcomePageContent = {
  hero: {
    badge: string;
    title: string;
    highlight: string;
    description: string;
    primaryButton: string;
    primaryLink: string;
    secondaryButton: string;
    secondaryLink: string;
    note: string;
    backgroundImage?: string;
    backgroundPosition?: string;
  };
  features: {
    eyebrow: string;
    title: string;
    description: string;
    cards: {
      title: string;
      description: string;
    }[];
  };
  audiences: {
    eyebrow: string;
    title: string;
    description: string;
    cards: {
      title: string;
      description: string;
    }[];
  };
  steps: {
    eyebrow: string;
    title: string;
    cards: {
      number: string;
      title: string;
      description: string;
    }[];
  };
  cta: {
    eyebrow: string;
    title: string;
    description: string;
    primaryButton: string;
    primaryLink: string;
    secondaryButton: string;
    secondaryLink: string;
  };
  footer: {
    description: string;
    copyright: string;
  };
  appearance: {
    accentColor: string;
    backgroundColor: string;
    glass?: WelcomePageGlassSettings;
  };
  seo?: {
    title: string;
    description: string;
  };
  sectionOrder?: Array<"hero" | "features" | "audiences" | "steps" | "cta" | "footer">;
  sectionVisibility?: Partial<Record<"hero" | "features" | "audiences" | "steps" | "cta" | "footer", boolean>>;
};

export const defaultWelcomePageContent: WelcomePageContent = {
  hero: {
    badge: "Your professional story starts here",
    title: "Your work deserves",
    highlight: "a powerful online presence.",
    description:
      "Create a professional portfolio that showcases your skills, experience, projects, and achievements. Build your personal brand and make it easier for people to discover your work.",
    primaryButton: "Create Your Portfolio",
    primaryLink: "/signup",
    secondaryButton: "Explore Portfolios",
secondaryLink: "/explore",
    note: "Build your profile. Showcase your work. Grow your opportunities.",
    backgroundPosition: "center center",
  },

  features: {
    eyebrow: "WHY CHOOSE US",
    title: "More than just a portfolio",
    description:
      "Everything you need to present your professional identity with clarity, confidence, and style.",
    cards: [
      {
        title: "Your Professional Identity",
        description:
          "Bring your biography, experience, education, skills, and achievements together in one place.",
      },
      {
        title: "Showcase Your Work",
        description:
          "Present projects, services, and accomplishments in a polished and organized format.",
      },
      {
        title: "Grow Your Opportunities",
        description:
          "Give employers, clients, and collaborators an easier way to discover and contact you.",
      },
    ],
  },

  audiences: {
    eyebrow: "WHO IT IS FOR",
    title: "Built for ambitious professionals",
    description:
      "Whether you are starting your career or growing an established business, create a presence that reflects your value.",
    cards: [
      {
        title: "Students & Graduates",
        description:
          "Showcase your education, projects, skills, and potential as you prepare for your next opportunity.",
      },
      {
        title: "Professionals",
        description:
          "Present your experience, achievements, and expertise in one professional destination.",
      },
      {
        title: "Entrepreneurs & Creatives",
        description:
          "Show potential clients what you do, what you have built, and how they can work with you.",
      },
    ],
  },

  steps: {
    eyebrow: "HOW IT WORKS",
    title: "From profile to professional presence",
    cards: [
      {
        number: "01",
        title: "Create your profile",
        description:
          "Add your name, professional title, biography, and contact information.",
      },
      {
        number: "02",
        title: "Showcase your value",
        description:
          "Add your skills, work experience, projects, services, and achievements.",
      },
      {
        number: "03",
        title: "Share your portfolio",
        description:
          "Publish your professional page and share it with employers, clients, and your network.",
      },
    ],
  },

  cta: {
    eyebrow: "YOUR NEXT CHAPTER STARTS HERE",
    title: "Make your professional story count.",
    description:
      "Build a portfolio that helps people understand who you are, what you do, and the value you bring.",
    primaryButton: "Get Started",
    primaryLink: "/signup",
    secondaryButton: "Sign In",
    secondaryLink: "/login",
  },

  footer: {
    description:
      "A professional space to showcase your story, skills, experience, and ambitions.",
    copyright: "All rights reserved.",
  },

  appearance: {
    accentColor: "#6366F1",
    backgroundColor: "#05070D",
    glass: {
      enabled: true,
      strength: 0.72,
      frost: 0.18,
      transparency: 0.72,
      reflection: 0.65,
      depth: 0.65,
      radius: 24,
    },
  },
  seo: {
    title: "Crispus Nguni | Professional Portfolios",
    description: "Create and discover professional portfolios with Crispus Nguni.",
  },
  sectionOrder: ["hero", "features", "audiences", "steps", "cta", "footer"],
  sectionVisibility: {
    hero: true,
    features: true,
    audiences: true,
    steps: true,
    cta: true,
    footer: true,
  },
};
export type WelcomePageStorage = {
  version: 1;
  draft: WelcomePageContent;
  published: WelcomePageContent | null;
  publishedAt: string | null;
};

export type WelcomePageBackgroundSettings = {
  backgroundImage: string;
  backgroundPosition: string;
  backgroundColor: string;
  accentColor: string;
};

export type WelcomePageCMSState = {
  draft: WelcomePageContent;
  published: WelcomePageContent | null;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
};

export function isWelcomePageContent(
  value: unknown,
): value is WelcomePageContent {
  if (!isRecord(value)) return false;
  const hero = value.hero;
  const features = value.features;
  const audiences = value.audiences;
  const steps = value.steps;
  const cta = value.cta;
  const footer = value.footer;
  const appearance = value.appearance;
  if (!isRecord(hero) || !isRecord(features) || !isRecord(audiences) || !isRecord(steps) ||
      !isRecord(cta) || !isRecord(footer) || !isRecord(appearance)) return false;

  const text = (record: Record<string, unknown>, key: string, max = 2_000) =>
    typeof record[key] === "string" && record[key].length <= max;
  const cards = (record: Record<string, unknown>, key: string, fields: readonly string[]) =>
    Array.isArray(record[key]) && record[key].length > 0 && record[key].length <= 8 &&
    record[key].every((card) => isRecord(card) && fields.every((field) => text(card, field, 1_000)));
  const glass = appearance.glass;
  const glassValid = glass === undefined || (
    isRecord(glass) && typeof glass.enabled === "boolean" &&
    [glass.strength, glass.frost, glass.transparency, glass.reflection, glass.depth].every(
      (number) => typeof number === "number" && Number.isFinite(number) && number >= 0 && number <= 1,
    ) && typeof glass.radius === "number" && Number.isFinite(glass.radius) && glass.radius >= 0 && glass.radius <= 64
  );
  const background = hero.backgroundImage;
  const backgroundPosition = hero.backgroundPosition;
  const sectionKeys = ["hero", "features", "audiences", "steps", "cta", "footer"] as const;
  const sectionOrder = value.sectionOrder;
  const sectionVisibility = value.sectionVisibility;
  const seo = value.seo;
  const backgroundValid = background === undefined || background === "" || (
    typeof background === "string" && background.length <= 2_048 && isHttpsUrl(background)
  );

  return (
    ["badge", "title", "highlight", "description", "primaryButton", "primaryLink", "secondaryButton", "secondaryLink", "note"]
      .every((key) => text(hero, key, key.endsWith("Link") ? 2_048 : 2_000)) &&
    isSafeWelcomePageHref(hero.primaryLink) && isSafeWelcomePageHref(hero.secondaryLink) &&
    text(features, "eyebrow") && text(features, "title") && text(features, "description") && cards(features, "cards", ["title", "description"]) &&
    text(audiences, "eyebrow") && text(audiences, "title") && text(audiences, "description") && cards(audiences, "cards", ["title", "description"]) &&
    text(steps, "eyebrow") && text(steps, "title") && cards(steps, "cards", ["number", "title", "description"]) &&
    text(cta, "eyebrow") && text(cta, "title") && text(cta, "description") && text(cta, "primaryButton", 100) &&
    text(cta, "primaryLink", 2_048) && text(cta, "secondaryButton", 100) && text(cta, "secondaryLink", 2_048) &&
    isSafeWelcomePageHref(cta.primaryLink) && isSafeWelcomePageHref(cta.secondaryLink) &&
    text(footer, "description") && text(footer, "copyright", 300) &&
    typeof appearance.accentColor === "string" && /^#[0-9a-f]{6}$/i.test(appearance.accentColor) &&
    typeof appearance.backgroundColor === "string" && /^#[0-9a-f]{6}$/i.test(appearance.backgroundColor) &&
    glassValid && backgroundValid &&
    (backgroundPosition === undefined || (typeof backgroundPosition === "string" && backgroundPosition.length <= 48 && /^(?:center|left|right|top|bottom|\d{1,3}(?:\.\d+)?%)(?:\s+(?:center|left|right|top|bottom|\d{1,3}(?:\.\d+)?%))?$/.test(backgroundPosition))) &&
    (seo === undefined || (isRecord(seo) && text(seo, "title", 80) && text(seo, "description", 180))) &&
    (sectionOrder === undefined || (Array.isArray(sectionOrder) && sectionOrder.length === sectionKeys.length && new Set(sectionOrder).size === sectionKeys.length && sectionKeys.every((key) => sectionOrder.includes(key)))) &&
    (sectionVisibility === undefined || (isRecord(sectionVisibility) && Object.keys(sectionVisibility).every((key) => sectionKeys.includes(key as typeof sectionKeys[number]) && typeof sectionVisibility[key] === "boolean")))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

const welcomeRoutes = new Set([
  "/", "/about", "/how-it-works", "/services", "/contact", "/explore", "/solutions", "/consultation", "/login", "/signup",
]);

/** Keeps CMS actions on existing internal destinations or secure external links. */
export function safeWelcomePageHref(value: unknown, fallback: string): string {
  return isSafeWelcomePageHref(value) ? value as string : fallback;
}

function isSafeWelcomePageHref(value: unknown): boolean {
  if (typeof value !== "string" || value.length > 2_048) return false;
  if (value.startsWith("/") && !value.startsWith("//")) {
    try {
      const url = new URL(value, "https://crispus.invalid");
      const isPortfolio = /^\/p\/[A-Za-z0-9_-]+$/.test(url.pathname);
      return url.origin === "https://crispus.invalid" && (welcomeRoutes.has(url.pathname) || isPortfolio);
    } catch {
      return false;
    }
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}


export function normalizeWelcomePageContent(
  value: WelcomePageContent,
): WelcomePageContent {
  const savedGlass = value.appearance.glass;

  return {
    ...value,
    hero: {
      ...value.hero,
      backgroundPosition: value.hero.backgroundPosition ?? "center center",
    },
    seo: value.seo ?? defaultWelcomePageContent.seo,
    sectionOrder: value.sectionOrder ?? defaultWelcomePageContent.sectionOrder,
    sectionVisibility: value.sectionVisibility ?? defaultWelcomePageContent.sectionVisibility,
    appearance: {
      ...value.appearance,
      glass: {
        ...defaultWelcomePageContent.appearance.glass!,
        ...(savedGlass && typeof savedGlass === "object" ? savedGlass : {}),
      },
    },
  };
}

/** Selects a validated draft only for an authorized Next draft-mode preview. */
export function resolveWelcomePageContent(
  stored: unknown,
  previewDraft = false,
): WelcomePageContent {
  if (!isRecord(stored)) return defaultWelcomePageContent;
  const cms = isRecord(stored.__cms) ? stored.__cms : {};
  if (previewDraft && isWelcomePageContent(cms.draft)) {
    return normalizeWelcomePageContent(cms.draft);
  }
  const published: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(stored)) {
    if (key !== "__cms") published[key] = value;
  }
  return isWelcomePageContent(published)
    ? normalizeWelcomePageContent(published)
    : defaultWelcomePageContent;
}

const DEFAULT_WELCOME_BACKGROUND: WelcomePageBackgroundSettings = {
  backgroundImage: "",
  backgroundPosition: "center center",
  backgroundColor: "#05070D",
  accentColor: "#6366F1",
};

/** Resolves only published content unless a server-authorized preview is active. */
export function resolveWelcomePageBackground(
  stored: unknown,
  previewDraft = false,
): WelcomePageBackgroundSettings {
  if (!isRecord(stored)) return DEFAULT_WELCOME_BACKGROUND;
  const metadata = isRecord(stored.__cms) ? stored.__cms : {};
  const draft = previewDraft && isWelcomePageContent(metadata.draft)
    ? metadata.draft
    : null;
  const publishedContent: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(stored)) {
    if (key !== "__cms") publishedContent[key] = value;
  }
  const content = draft ?? (isWelcomePageContent(publishedContent) ? publishedContent : null);
  if (!content) return DEFAULT_WELCOME_BACKGROUND;
  return {
    backgroundImage: content.hero.backgroundImage ?? "",
    backgroundPosition: content.hero.backgroundPosition ?? "center center",
    backgroundColor: content.appearance.backgroundColor,
    accentColor: content.appearance.accentColor,
  };
}

export function readWelcomePageStorage(
  value: unknown,
): WelcomePageStorage {
  if (!value || typeof value !== "object") {
    return {
      version: 1,
      draft: defaultWelcomePageContent,
      published: null,
      publishedAt: null,
    };
  }

  const stored = value as Record<string, unknown>;

  if (
    stored.version === 1 &&
    isWelcomePageContent(stored.draft)
  ) {
    return {
      version: 1,
      draft: normalizeWelcomePageContent(stored.draft),
      published: isWelcomePageContent(stored.published)
        ? normalizeWelcomePageContent(stored.published)
        : null,
      publishedAt:
        typeof stored.publishedAt === "string"
          ? stored.publishedAt
          : null,
    };
  }

  // Support content saved by your existing editor.
  if (isWelcomePageContent(value)) {
    return {
      version: 1,
      draft: normalizeWelcomePageContent(value),
      published: normalizeWelcomePageContent(value),
      publishedAt: null,
    };
  }

  return {
    version: 1,
    draft: defaultWelcomePageContent,
    published: null,
    publishedAt: null,
  };
}
