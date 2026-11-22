import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the shared Navbar marks nested destinations and the brand route as current", async () => {
  const navbar = await source("../src/components/navigation/Navbar.tsx");
  assert.match(navbar, /usePathname\(\)/);
  assert.match(navbar, /pathname === href \|\| \(href !== "\/" && pathname\.startsWith\(`\$\{href\}\/`\)\)/);
  assert.match(navbar, /aria-current=\{pathname === "\/" \? "page" : undefined\}/);
assert.match(navbar, /active=\{isActive\("\/login"\)\}/);
assert.match(navbar, /active=\{isActive\("\/signup"\)\}/);
    assert.match(navbar, /navbar-icon-control-active/);
  assert.match(navbar, /items\.map\(\(\{ label, href, Icon \}\)/);
  assert.match(navbar, /active=\{isActive\(href\)\}/);
});

test("Display Studio shows open state in both responsive contexts and retains the Liquid Glass editor", async () => {
  const [navbar, control, glass] = await Promise.all([
    source("../src/components/navigation/Navbar.tsx"),
    source("../src/components/navigation/DisplayStudioControlCentre.tsx"),
    source("../src/components/ui/LiquidLensSurface.tsx"),
  ]);
  assert.equal((navbar.match(/<DisplayStudioControlCentre\b/g) ?? []).length, 2);
  assert.match(control, /aria-expanded=\{open\}/);
  assert.match(control, /aria-labelledby=\{`\$\{dialogId\}-title`\}/);
  assert.match(control, /navbar-icon-control-active/);
    assert.match(control, /Personal appearance/);
  assert.match(control, /reader\.updatePreference\(/);
  assert.match(control, /<LiquidLensSurface/);
  assert.match(glass, /from "@samasante\/liquid-glass"/);
});

test("Login, Signup, Explore and the CMS public pages use the shared public navigation", async () => {
  const paths = [
    "../src/app/login/layout.tsx",
    "../src/app/signup/layout.tsx",
    "../src/app/explore/page.tsx",
    "../src/app/about/page.tsx",
    "../src/app/how-it-works/page.tsx",
    "../src/app/services/page.tsx",
    "../src/app/contact/page.tsx",
  ];
  for (const path of paths) {
    const content = await source(path);
    assert.match(content, /Navbar|PublicCmsPage/);
  }
});

test("Welcome, authentication, Explore and CMS pages share the configured background renderer", async () => {
  const paths = [
    "../src/components/welcome-page/WelcomePageView.tsx",
    "../src/app/login/layout.tsx",
    "../src/app/signup/layout.tsx",
    "../src/app/explore/page.tsx",
  ];
  for (const path of paths) {
    assert.match(await source(path), /WelcomePageBackground|WelcomeAuthBackground/);
  }
  const publicPage = await source("../src/components/public-site/PublicCmsPage.tsx");
  assert.match(publicPage, /WelcomePageBackground/);
  assert.match(publicPage, /<Navbar\s*\/>/);
  const background = await source("../src/components/welcome-page/WelcomePageBackground.tsx");
  assert.match(background, /url\.protocol === "https:"/);
  assert.match(background, /!url\.username && !url\.password/);
  assert.match(background, /useReducedMotion/);
  assert.match(background, /autoPlay=\{mayAnimateVideo\}/);
assert.match(background, /loop=\{mayAnimateVideo\}/);
  assert.match(background, /onError=\{\(\) => setFailedMediaUrl\(mediaUrl\)\}/);
  assert.match(background, /mediaUrl && !mediaFailed/);
  assert.match(background, /backgroundColor: color/);
});

test("public navigation exposes CMS pages and no longer exposes standalone Insights", async () => {
  const navbar = await source("../src/components/navigation/Navbar.tsx");
  for (const href of ["/about", "/how-it-works", "/services", "/contact"]) assert.match(navbar, new RegExp(`href: "${href.replaceAll("/", "\\/")}"`));
  assert.doesNotMatch(navbar, /href: "\/insights"/);
  const mobileUi = navbar.slice(navbar.indexOf('id="public-mobile-navigation"'));
  assert.match(mobileUi, /items\.map/);
assert.match(navbar, /\.\.\.links/);
});

test("portfolio Insights remain reachable under their portfolio and legacy index redirects", async () => {
  const [section, detail, legacy] = await Promise.all([
    source("../src/components/portfolio/sections/InsightsSection.tsx"),
    source("../src/app/p/[slug]/insights/[insightSlug]/page.tsx"),
    source("../src/app/insights/page.tsx"),
  ]);
  assert.match(section, /\/p\/\$\{encodeURIComponent\(portfolioSlug\)\}\/insights/);
  assert.match(detail, /published: true/);
  assert.match(detail, /portfolio: \{ slug, published: true \}/);
  assert.match(legacy, /redirect\("\/explore"\)/);
});

test("public page transitions respect the saved reduced-motion preference", async () => {
  const transition = await source("../src/components/ui/PageTransition.tsx");
  assert.match(transition, /usePathname\(\)/);
  assert.match(transition, /preferences\.reduceMotion/);
  assert.match(transition, /page-transition min-h-screen/);
});

test("personal preferences remain separate browser-local overrides over global defaults", async () => {
  const [reader, editor] = await Promise.all([
    source("../src/components/ui/ReaderProvider.tsx"),
    source("../src/components/admin/DisplayStudioEditor.tsx"),
  ]);
  assert.match(reader, /localStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(reader, /localStorage\.setItem\(/);
  assert.match(reader, /resolveDisplayStudioPreferences\(\s*globalPreferences,\s*parsePreferenceOverrides/);
  assert.match(reader, /localStorage\.removeItem\(STORAGE_KEY\)/);
  assert.match(editor, /browser and remain separate from global defaults/);
  assert.match(editor, /browser storage is unavailable/);
  assert.doesNotMatch(reader, /\/api\/display-studio\/personal/);
});
