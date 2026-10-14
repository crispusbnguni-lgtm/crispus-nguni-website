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
  };
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
    secondaryLink: "/about",
    note: "Build your profile. Showcase your work. Grow your opportunities.",
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
  },
};
export type WelcomePageStorage = {
  version: 1;
  draft: WelcomePageContent;
  published: WelcomePageContent | null;
  publishedAt: string | null;
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
  if (!value || typeof value !== "object") {
    return false;
  }

  const content = value as Record<string, unknown>;

  return (
    typeof content.hero === "object" &&
    content.hero !== null &&
    typeof content.features === "object" &&
    content.features !== null &&
    typeof content.audiences === "object" &&
    content.audiences !== null &&
    typeof content.steps === "object" &&
    content.steps !== null &&
    typeof content.cta === "object" &&
    content.cta !== null &&
    typeof content.footer === "object" &&
    content.footer !== null &&
    typeof content.appearance === "object" &&
    content.appearance !== null
  );
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
      draft: stored.draft,
      published: isWelcomePageContent(stored.published)
        ? stored.published
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
      draft: value,
      published: value,
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