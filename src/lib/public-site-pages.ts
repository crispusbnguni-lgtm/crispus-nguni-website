export const PUBLIC_SITE_PAGE_KEYS = [
  "about",
  "how-it-works",
  "services",
  "contact",
] as const;

export type PublicSitePageKey = (typeof PUBLIC_SITE_PAGE_KEYS)[number];
export type PublicSitePageSection = {
  id: string;
  kind: "text" | "cards" | "steps";
  title: string;
  body: string;
  visible: boolean;
  items: Array<{ title: string; body: string }>;
  mediaUrl?: string;
};

export type PublicSitePageContent = {
  metaTitle: string;
  metaDescription: string;
  socialImage: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  backgroundImage: string;
  backgroundPosition?: string;
  accentColor: string;
  ctaLabel: string;
  ctaHref: string;
  contactEmail: string;
  contactPhone: string;
  contactLocation: string;
  sections: PublicSitePageSection[];
};

function section(
  id: string,
  kind: PublicSitePageSection["kind"],
  title: string,
  body: string,
  items: PublicSitePageSection["items"] = [],
): PublicSitePageSection {
  return { id, kind, title, body, visible: true, items, mediaUrl: "" };
}

export const DEFAULT_PUBLIC_SITE_PAGES: Record<PublicSitePageKey, PublicSitePageContent> = {
  about: {
    metaTitle: "About Us | Crispus Nguni",
    metaDescription: "Learn about the Crispus Nguni professional portfolio platform and the principles behind it.",
    socialImage: "",
    eyebrow: "About the platform",
    title: "A clearer way to present professional work.",
    subtitle: "Crispus Nguni gives professionals a place to organise their experience, share their work and make their public profile easier to explore.",
    backgroundImage: "",
    backgroundPosition: "center center",
    accentColor: "#126BFF",
    ctaLabel: "Explore portfolios",
    ctaHref: "/explore",
    contactEmail: "",
    contactPhone: "",
    contactLocation: "",
    sections: [
      section("purpose", "text", "The platform", "A professional portfolio can bring biography, skills, experience, education and projects together in one shareable place."),
      section("principles", "cards", "Built around clarity and trust", "The experience is designed to make professional information easier to present and understand.", [
        { title: "Clarity", body: "Organise professional information so visitors can find what matters." },
        { title: "Professionalism", body: "Present work and experience in a consistent, considered format." },
        { title: "Accessibility", body: "Use readable layouts and personal display controls across the public experience." },
        { title: "Trust", body: "Keep profile visibility and published content under the professional's control." },
      ]),
    ],
  },
  "how-it-works": {
    metaTitle: "How It Works | Crispus Nguni",
    metaDescription: "See how to create, customise, publish and share a professional portfolio.",
    socialImage: "",
    eyebrow: "A simple workflow",
    title: "Build your profile. Share your work.",
    subtitle: "The platform guides professionals from account creation to a published portfolio they can share with others.",
    backgroundImage: "",
    backgroundPosition: "center center",
    accentColor: "#00C98B",
    ctaLabel: "Create an account",
    ctaHref: "/signup",
    contactEmail: "",
    contactPhone: "",
    contactLocation: "",
    sections: [
      section("journey", "steps", "From account to portfolio", "You control what information is added and when a portfolio is published.", [
        { title: "Create your account", body: "Sign up and complete the account checks required for your sign-in method." },
        { title: "Build your portfolio", body: "Add professional information such as your biography, skills, experience, education and projects." },
        { title: "Review and publish", body: "Choose what to show and publish when your profile is ready." },
        { title: "Share and receive enquiries", body: "Share your public portfolio. Visitors can use the enquiry or consultation options available on your profile." },
      ]),
      section("manage", "text", "Stay in control", "You can continue managing your professional information and portfolio visibility from your account."),
    ],
  },
  services: {
    metaTitle: "Services | Crispus Nguni",
    metaDescription: "Explore portfolio tools and professional enquiry features available through Crispus Nguni.",
    socialImage: "",
    eyebrow: "What the platform supports",
    title: "Tools to present and discover professional work.",
    subtitle: "Crispus Nguni combines portfolio publishing with public discovery and profile-level enquiry features.",
    backgroundImage: "",
    backgroundPosition: "center center",
    accentColor: "#D9A441",
    ctaLabel: "Explore professionals",
    ctaHref: "/explore",
    contactEmail: "",
    contactPhone: "",
    contactLocation: "",
    sections: [
      section("platform", "cards", "Platform capabilities", "Use the existing website features to create and share professional profiles.", [
        { title: "Portfolio builder", body: "Organise professional details and selected work in a public profile." },
        { title: "Portfolio discovery", body: "Explore published public profiles and filter the available directory." },
        { title: "Enquiries", body: "Visitors can submit enquiries through supported professional portfolio pages." },
        { title: "Consultation booking", body: "Where a professional has configured availability, visitors can request a consultation." },
      ]),
      section("optional", "text", "Professional services are offered separately", "Optional advice or consultation services depend on the individual professional, their published profile and available booking options. No price or availability is implied by this page."),
    ],
  },
  contact: {
    metaTitle: "Contact Us | Crispus Nguni",
    metaDescription: "Find the right way to contact a professional through their published portfolio.",
    socialImage: "",
    eyebrow: "Get in touch",
    title: "Connect with the right professional.",
    subtitle: "For a professional enquiry, visit the relevant published portfolio and use the contact or consultation options available there.",
    backgroundImage: "",
    backgroundPosition: "center center",
    accentColor: "#722BFF",
    ctaLabel: "Explore portfolios",
    ctaHref: "/explore",
    contactEmail: "",
    contactPhone: "",
    contactLocation: "",
    sections: [
      section("portfolio-contact", "text", "Professional enquiries", "Each professional manages their own profile and enquiry options. Browse public portfolios to find the person you want to reach."),
      section("consultations", "text", "Consultations", "Consultation booking is available only where a professional has configured a consultation type and availability."),
    ],
  },
};

export function isPublicSitePageKey(value: unknown): value is PublicSitePageKey {
  return typeof value === "string" && (PUBLIC_SITE_PAGE_KEYS as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const ownKeys = Object.keys(value);
  return ownKeys.length === keys.length && ownKeys.every((key) => keys.includes(key));
}

function text(value: unknown, max: number, required = false): value is string {
  return typeof value === "string" && value.length <= max &&
    (!required || value.trim().length > 0) && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);
}

function safeHref(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//")) {
    try {
      const url = new URL(value, "https://crispus.invalid");
      return url.origin === "https://crispus.invalid" && [
        "/", "/about", "/how-it-works", "/services", "/contact", "/explore", "/signup", "/login", "/consultation",
      ].includes(url.pathname);
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

function safeHttps(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function validSection(value: unknown): value is PublicSitePageSection {
  const legacyKeys = ["id", "kind", "title", "body", "visible", "items"];
  const mediaKeys = [...legacyKeys, "mediaUrl"];
  if (!isRecord(value)) return false;
  if ((!hasExactKeys(value, legacyKeys) && !hasExactKeys(value, mediaKeys)) || !text(value.id, 48, true) || !/^[a-z0-9-]+$/.test(value.id) ||
      !["text", "cards", "steps"].includes(String(value.kind)) || !text(value.title, 180, true) ||
      !text(value.body, 2_500) || typeof value.visible !== "boolean" || !Array.isArray(value.items) || value.items.length > 8) return false;
  const mediaUrl: unknown = value.mediaUrl === undefined ? "" : value.mediaUrl;
  if (!text(mediaUrl, 2_048) || !safeHttps(mediaUrl)) return false;
  return value.items.every((item) => isRecord(item) && hasExactKeys(item, ["title", "body"]) && text(item.title, 160, true) && text(item.body, 1_000, true));
}

export function isPublicSitePageContent(value: unknown): value is PublicSitePageContent {
  const legacyKeys = [
    "metaTitle", "metaDescription", "socialImage", "eyebrow", "title", "subtitle",
    "backgroundImage", "accentColor", "ctaLabel", "ctaHref", "contactEmail",
    "contactPhone", "contactLocation", "sections",
  ];
  const mediaKeys = [...legacyKeys, "backgroundPosition"];
  return isRecord(value) && (hasExactKeys(value, legacyKeys) || hasExactKeys(value, mediaKeys)) &&
    text(value.metaTitle, 80, true) && text(value.metaDescription, 180, true) &&
    text(value.socialImage, 2_048) && safeHttps(value.socialImage) &&
    text(value.eyebrow, 100, true) && text(value.title, 180, true) && text(value.subtitle, 1_200, true) &&
    text(value.backgroundImage, 2_048) && safeHttps(value.backgroundImage) &&
    (value.backgroundPosition === undefined || (text(value.backgroundPosition, 48) && /^(?:center|left|right|top|bottom|\d{1,3}(?:\.\d+)?%)(?:\s+(?:center|left|right|top|bottom|\d{1,3}(?:\.\d+)?%))?$/.test(value.backgroundPosition))) &&
    text(value.accentColor, 7, true) && /^#[0-9a-f]{6}$/i.test(value.accentColor) &&
    text(value.ctaLabel, 100, true) && text(value.ctaHref, 2_048, true) && safeHref(value.ctaHref) &&
    text(value.contactEmail, 254) && (!value.contactEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.contactEmail)) &&
    text(value.contactPhone, 40) && (!value.contactPhone || /^[+\d().\-\s]{5,40}$/.test(value.contactPhone)) &&
    text(value.contactLocation, 180) && Array.isArray(value.sections) && value.sections.length > 0 &&
    value.sections.length <= 10 && value.sections.every(validSection) &&
    new Set(value.sections.map((item) => item.id)).size === value.sections.length;
}

export function getPublicSitePageContent(
  storedContent: unknown,
  pageKey: PublicSitePageKey,
): PublicSitePageContent {
  if (!isRecord(storedContent) || !isRecord(storedContent.__cms) || !isRecord(storedContent.__cms.pages)) {
    return DEFAULT_PUBLIC_SITE_PAGES[pageKey];
  }
  const page = storedContent.__cms.pages[pageKey];
  if (!isRecord(page) || !isPublicSitePageContent(page.published)) return DEFAULT_PUBLIC_SITE_PAGES[pageKey];
  return page.published;
}

export function getPublicSitePageAdminState(storedContent: unknown, pageKey: PublicSitePageKey) {
  const defaults = DEFAULT_PUBLIC_SITE_PAGES[pageKey];
  if (!isRecord(storedContent) || !isRecord(storedContent.__cms) || !isRecord(storedContent.__cms.pages)) {
    return { publishedContent: defaults, draftContent: null, history: [] as Array<{ content: PublicSitePageContent; publishedAt: string }>, publishedAt: null as string | null };
  }
  const page = storedContent.__cms.pages[pageKey];
  if (!isRecord(page)) return { publishedContent: defaults, draftContent: null, history: [] as Array<{ content: PublicSitePageContent; publishedAt: string }>, publishedAt: null as string | null };
  const history = Array.isArray(page.history) ? page.history.filter((item) =>
    isRecord(item) && isPublicSitePageContent(item.content) && typeof item.publishedAt === "string",
  ) as Array<{ content: PublicSitePageContent; publishedAt: string }> : [];
  return {
    publishedContent: isPublicSitePageContent(page.published) ? page.published : defaults,
    draftContent: isPublicSitePageContent(page.draft) ? page.draft : null,
    history,
    publishedAt: typeof page.publishedAt === "string" ? page.publishedAt : null,
  };
}
