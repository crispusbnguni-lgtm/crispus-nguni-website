export type ExploreFilters = {
  q: string;
  location: string;
  skill: string;
  education: string;
  experience: string;
  project: string;
};

export type ExploreQueryInput = Partial<
  Record<keyof ExploreFilters | "page", string | string[] | undefined>
>;

export const EMPTY_EXPLORE_FILTERS: ExploreFilters = {
  q: "",
  location: "",
  skill: "",
  education: "",
  experience: "",
  project: "",
};

export function isValidPortfolioSlug(value: unknown): value is string {
  return typeof value === "string" &&
    value.length <= 100 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function readQueryValue(value: string | string[] | undefined): {
  value: string;
  valid: boolean;
} {
  if (value === undefined) return { value: "", valid: true };
  if (typeof value !== "string" || value.length > 100 || /[\u0000-\u001f\u007f]/.test(value)) {
    return { value: "", valid: false };
  }

  return { value: value.trim(), valid: true };
}

export function parseExploreQuery(input: ExploreQueryInput): {
  filters: ExploreFilters;
  requestedPage: number;
  invalid: boolean;
} {
  const filters = { ...EMPTY_EXPLORE_FILTERS };
  let invalid = false;

  for (const key of Object.keys(filters) as Array<keyof ExploreFilters>) {
    const parsed = readQueryValue(input[key]);
    filters[key] = parsed.value;
    invalid ||= !parsed.valid;
  }

  const rawPage = readQueryValue(input.page);
  let requestedPage = 1;
  if (!rawPage.valid) {
    invalid = true;
  } else if (rawPage.value) {
    if (!/^\d{1,16}$/.test(rawPage.value)) {
      invalid = true;
    } else {
      const value = Number(rawPage.value);
      if (!Number.isSafeInteger(value) || value < 1) {
        invalid = true;
      } else {
        requestedPage = value;
      }
    }
  }

  return { filters, requestedPage, invalid };
}

export function resolveExplorePage(
  requestedPage: number,
  totalCount: number,
  pageSize: number,
): { currentPage: number; totalPages: number; skip: number } {
  const totalPages = Math.ceil(totalCount / pageSize);
  const currentPage = Math.min(
    Math.max(1, requestedPage),
    Math.max(totalPages, 1),
  );

  return {
    currentPage,
    totalPages,
    skip: (currentPage - 1) * pageSize,
  };
}

export function safePortfolioImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2_048 || /[\u0000-\u0020\u007f]/.test(value)) {
    return null;
  }

  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    try {
      const parsed = new URL(value, "https://crispus.invalid");
      return parsed.origin === "https://crispus.invalid" ? `${parsed.pathname}${parsed.search}` : null;
    } catch {
      return null;
    }
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function safePortfolioBackground(value: unknown):
  | { kind: "color"; value: string }
  | { kind: "image"; value: string }
  | null {
  if (typeof value !== "string" || value.length > 2_048) return null;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return { kind: "color", value: trimmed };
  }

  const image = safePortfolioImageUrl(trimmed);
  return image ? { kind: "image", value: image } : null;
}

export function safePortfolioExternalLink(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2_048 || /[\u0000-\u0020\u007f]/.test(value)) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function safePortfolioPhoneHref(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40 || !/^\+?[0-9().\-\s]{5,40}$/.test(value)) {
    return null;
  }

  const normalized = value.replace(/[().\-\s]/g, "");
  return normalized.length >= 5 ? `tel:${normalized}` : null;
}

export function resolvePublicSiteBaseUrl(
  candidates: unknown[] = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
  ],
): string {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    try {
      const url = new URL(candidate);
      if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password) {
        return url.origin;
      }
    } catch {
      // Try the next configured base URL.
    }
  }

  return "http://localhost:3000";
}
