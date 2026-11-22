import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

globalThis.__publicPortfolioState = { value: null, error: null, calls: [] };
globalThis.__exploreState = { count: 0, pageArgs: null, where: null };
globalThis.__sitemapState = { args: null, values: [], insightArgs: null, insights: [] };

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/navigation") {
      return {
        url: dataModule(`export function notFound() { const error = new Error("not found"); error.code = "NOT_FOUND"; throw error; }`),
        shortCircuit: true,
      };
    }
    if (specifier === "next/link") {
      return { url: dataModule("export default function Link() { return null; }"), shortCircuit: true };
    }
    if (specifier === "@/lib/prisma") {
      return {
        url: dataModule(`export const prisma = {
          portfolioSite: {
            async findUnique(args) {
              globalThis.__publicPortfolioState.calls.push(args);
              if (globalThis.__publicPortfolioState.error) throw globalThis.__publicPortfolioState.error;
              return globalThis.__publicPortfolioState.value;
            },
            async count({ where }) { globalThis.__exploreState.where = where; return globalThis.__exploreState.count; },
            async findMany(args) {
              if (args.select?.id === true) globalThis.__exploreState.pageArgs = args;
              if (args.select?.slug === true) {
                globalThis.__sitemapState.args = args;
                return globalThis.__sitemapState.values;
              }
              return [];
            },
          },
          insight: {
            async findMany(args) {
              globalThis.__sitemapState.insightArgs = args;
              return globalThis.__sitemapState.insights;
            },
          },
          skill: { async findMany() { return []; } },
          education: { async findMany() { return []; } },
          experience: { async findMany() { return []; } },
          project: { async findMany() { return []; } },
        };`),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/portfolio-public") {
      return { url: new URL("../src/lib/portfolio-public.ts", import.meta.url).href, shortCircuit: true };
    }
    if (specifier === "@/components/portfolio/templates/ProfessionalTemplate") {
      return { url: dataModule("export function ProfessionalTemplate({ portfolio }) { globalThis.__renderedPortfolio = portfolio; return null; }"), shortCircuit: true };
    }
    if (specifier === "@/components/navigation/Navbar" || specifier === "@/components/ui/LensGlass" || specifier === "@/components/portfolio/PortfolioImage" || specifier === "@/components/welcome-page/WelcomePageBackground") {
      return { url: dataModule("export function Navbar() { return null; } export function LensGlass() { return null; } export function PortfolioImage() { return null; } export default function WelcomePageBackground() { return null; }"), shortCircuit: true };
    }
    if (specifier === "@/lib/welcome-page-background") {
      return { url: dataModule("export async function getWelcomeBackgroundSettings() { return { backgroundImage: null, accentColor: \"#126BFF\", backgroundColor: \"#05070D\" }; }"), shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".tsx")) {
      const source = readFileSync(fileURLToPath(url), "utf8");
      return {
        format: "module",
        source: ts.transpileModule(source, {
          compilerOptions: {
            jsx: ts.JsxEmit.ReactJSX,
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
          },
        }).outputText,
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

const publicTools = await import("../src/lib/portfolio-public.ts");
const portfolioPage = await import("../src/app/p/[slug]/page.tsx");
const { default: explorePage } = await import("../src/app/explore/page.tsx");
const { default: sitemap } = await import("../src/app/sitemap.ts");

test("portfolio slugs accept generated lowercase slugs and reject malformed or oversized values", () => {
  assert.equal(publicTools.isValidPortfolioSlug("jane-doe-kq4x9"), true);
  for (const value of ["", "A-B", "two--hyphens", "../admin", "a".repeat(101), 42]) {
    assert.equal(publicTools.isValidPortfolioSlug(value), false);
  }
});

test("Explore query validation handles empty, case-preserving, duplicate, oversized and invalid page values", () => {
  assert.deepEqual(publicTools.parseExploreQuery({}), {
    filters: { q: "", location: "", skill: "", education: "", experience: "", project: "" },
    requestedPage: 1,
    invalid: false,
  });
  assert.equal(publicTools.parseExploreQuery({ q: "  Engineer  ", skill: "TypeScript" }).filters.q, "Engineer");
  const duplicate = publicTools.parseExploreQuery({ q: ["first", "second"] });
  assert.equal(duplicate.invalid, true);
  assert.equal(duplicate.filters.q, "");
  assert.equal(publicTools.parseExploreQuery({ q: "x".repeat(101) }).invalid, true);
  assert.equal(publicTools.parseExploreQuery({ page: "1e9" }).invalid, true);
  assert.equal(publicTools.parseExploreQuery({ page: "9007199254740992" }).invalid, true);
});

test("page resolution clamps out-of-range page requests before calculating database offset", () => {
  assert.deepEqual(publicTools.resolveExplorePage(99_999, 25, 12), {
    currentPage: 3,
    totalPages: 3,
    skip: 24,
  });
  assert.deepEqual(publicTools.resolveExplorePage(1, 0, 12), {
    currentPage: 1,
    totalPages: 0,
    skip: 0,
  });
});

test("portfolio URLs reject unsafe schemes, credentials and CSS injection strings", () => {
  assert.equal(publicTools.safePortfolioExternalLink("javascript:alert(1)"), null);
  assert.equal(publicTools.safePortfolioExternalLink("https://user:pass@example.com"), null);
  assert.equal(publicTools.safePortfolioExternalLink("https://example.com/work"), "https://example.com/work");
  assert.equal(publicTools.safePortfolioImageUrl("//evil.example/image.png"), null);
  assert.equal(publicTools.safePortfolioImageUrl("data:image/svg+xml,<svg/>") , null);
  assert.equal(publicTools.safePortfolioBackground('#12abEF').kind, "color");
  assert.equal(publicTools.safePortfolioBackground('https://example.com/bg.jpg').kind, "image");
  const quoted = publicTools.safePortfolioBackground('https://x.test/");background:url(javascript:1)');
  assert.equal(quoted.kind, "image");
  assert.equal(quoted.value.includes('\"'), false);
  assert.equal(publicTools.safePortfolioPhoneHref("javascript:alert(1)"), null);
});

test("published public and unlisted portfolios render, while drafts 404", async () => {
  globalThis.__publicPortfolioState = {
    value: { published: true, visibility: "PUBLIC", websiteBackground: "#05070D", name: "Public" },
    error: null,
    calls: [],
  };
  const publicPage = await portfolioPage.default({ params: Promise.resolve({ slug: "public-profile" }) });
  assert.equal(publicPage.props.children.props.portfolio.visibility, "PUBLIC");

  globalThis.__publicPortfolioState.value = { published: true, visibility: "UNLISTED", websiteBackground: null, name: "Shared" };
  const unlistedPage = await portfolioPage.default({ params: Promise.resolve({ slug: "shared-profile" }) });
  assert.equal(unlistedPage.props.children.props.portfolio.visibility, "UNLISTED");

  globalThis.__publicPortfolioState.value = { published: false, visibility: "PUBLIC" };
  await assert.rejects(
    portfolioPage.default({ params: Promise.resolve({ slug: "draft-profile" }) }),
    (error) => error.code === "NOT_FOUND",
  );
});

test("invalid slugs avoid database reads and database errors are not converted to 404", async () => {
  globalThis.__publicPortfolioState = { value: null, error: null, calls: [] };
  await assert.rejects(
    portfolioPage.default({ params: Promise.resolve({ slug: "../private" }) }),
    (error) => error.code === "NOT_FOUND",
  );
  assert.equal(globalThis.__publicPortfolioState.calls.length, 0);

  globalThis.__publicPortfolioState.error = new Error("database unavailable");
  await assert.rejects(
    portfolioPage.default({ params: Promise.resolve({ slug: "valid-slug" }) }),
    /database unavailable/,
  );
});

test("public metadata is indexable only for PUBLIC portfolios and avoids private fields", async () => {
  globalThis.__publicPortfolioState = {
    value: { published: true, visibility: "PUBLIC", name: "A. Professional", title: "Designer", bio: "Public bio", profileImage: "https://images.example.test/profile.jpg", email: "private@example.test" },
    error: null,
    calls: [],
  };
  const publicMetadata = await portfolioPage.generateMetadata({ params: Promise.resolve({ slug: "a-professional" }) });
  assert.equal(publicMetadata.robots.index, true);
  assert.equal(publicMetadata.alternates.canonical.endsWith("/p/a-professional"), true);
  assert.match(publicMetadata.title, /A\. Professional/);
  assert.equal(JSON.stringify(publicMetadata).includes("private@example.test"), false);

  globalThis.__publicPortfolioState.value.visibility = "UNLISTED";
  const unlistedMetadata = await portfolioPage.generateMetadata({ params: Promise.resolve({ slug: "a-professional" }) });
  assert.equal(unlistedMetadata.robots.index, false);
  assert.equal(unlistedMetadata.alternates, undefined);
});

test("Explore combines filters, restricts results to published PUBLIC portfolios and clamps pagination", async () => {
  globalThis.__exploreState = { count: 25, pageArgs: null, where: null };
  await explorePage({ searchParams: Promise.resolve({ q: "Architect", skill: "Design", education: "Nairobi University", page: "99999" }) });

  assert.equal(globalThis.__exploreState.where.published, true);
  assert.equal(globalThis.__exploreState.where.visibility, "PUBLIC");
  const conditions = globalThis.__exploreState.where.AND;
  assert.ok(conditions.some((condition) => condition.OR?.some((entry) => entry.name?.contains === "Architect")));
  assert.ok(conditions.some((condition) => condition.showSkills === true));
  assert.ok(conditions.some((condition) => condition.showEducation === true));
  assert.equal(globalThis.__exploreState.pageArgs.skip, 24);
  assert.deepEqual(globalThis.__exploreState.pageArgs.orderBy, [{ updatedAt: "desc" }, { id: "desc" }]);
});

test("sitemap queries public portfolios and published insights under their owner portfolio", async () => {
  globalThis.__sitemapState = {
    args: null,
    values: [{ slug: "public-profile", updatedAt: new Date("2026-11-01T00:00:00Z") }],
    insightArgs: null,
    insights: [{ slug: "published-insight", portfolio: { slug: "public-profile" } }],
  };
  const entries = await sitemap();

  assert.deepEqual(globalThis.__sitemapState.args.where, { published: true, visibility: "PUBLIC" });
  assert.deepEqual(globalThis.__sitemapState.insightArgs.where, { published: true, portfolio: { published: true, visibility: "PUBLIC" } });
  assert.ok(entries.some((entry) => entry.url.endsWith("/p/public-profile")));
  assert.ok(entries.some((entry) => entry.url.endsWith("/p/public-profile/insights/published-insight")));
  assert.equal(entries.some((entry) => entry.url.includes("unlisted")), false);
});
