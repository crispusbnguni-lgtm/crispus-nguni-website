import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  defaultWelcomePageContent,
  isWelcomePageContent,
  safeWelcomePageHref,
  resolveWelcomePageContent,
  resolveWelcomePageBackground,
} from "../src/lib/welcome-page.ts";

test("complete default CMS content passes server-side validation", () => {
  assert.equal(isWelcomePageContent(defaultWelcomePageContent), true);
});

test("CMS validation rejects malformed nested values, unsafe links, and invalid glass settings", () => {
  assert.equal(isWelcomePageContent({ ...defaultWelcomePageContent, hero: { title: "Only a title" } }), false);
  assert.equal(
    isWelcomePageContent({
      ...defaultWelcomePageContent,
      cta: { ...defaultWelcomePageContent.cta, primaryLink: "javascript:alert(1)" },
    }),
    false,
  );
  assert.equal(
    isWelcomePageContent({
      ...defaultWelcomePageContent,
      appearance: {
        ...defaultWelcomePageContent.appearance,
        glass: { ...defaultWelcomePageContent.appearance.glass, strength: 12 },
      },
    }),
    false,
  );
});

test("CMS action hrefs resolve only to existing destinations or HTTPS external URLs", () => {
  assert.equal(safeWelcomePageHref("/explore#portfolio-search", "/signup"), "/explore#portfolio-search");
  assert.equal(safeWelcomePageHref("/p/example-user", "/signup"), "/p/example-user");
  assert.equal(safeWelcomePageHref("/learn", "/signup"), "/signup");
  assert.equal(safeWelcomePageHref("//attacker.test/path", "/signup"), "/signup");
  assert.equal(safeWelcomePageHref("javascript:alert(1)", "/signup"), "/signup");
  assert.equal(safeWelcomePageHref("https://example.test/action", "/signup"), "https://example.test/action");
});

test("public homepage reads published content and background while draft preview remains explicit", () => {
  const published = {
    ...defaultWelcomePageContent,
    hero: { ...defaultWelcomePageContent.hero, backgroundImage: "https://media.example/live.mp4", backgroundPosition: "right center" },
    seo: { title: "Published title", description: "Published description" },
  };
  const draft = {
    ...defaultWelcomePageContent,
    hero: { ...defaultWelcomePageContent.hero, title: "PRIVATE DRAFT", backgroundImage: "https://media.example/draft.jpg" },
  };
  const stored = { ...published, __cms: { draft } };
  assert.equal(resolveWelcomePageContent(stored, false).hero.title, published.hero.title);
  assert.equal(resolveWelcomePageContent(stored, true).hero.title, "PRIVATE DRAFT");
  assert.deepEqual(resolveWelcomePageBackground(stored), {
    backgroundImage: "https://media.example/live.mp4",
    backgroundPosition: "right center",
    backgroundColor: published.appearance.backgroundColor,
    accentColor: published.appearance.accentColor,
  });
  assert.equal(resolveWelcomePageBackground(stored, true).backgroundImage, "https://media.example/draft.jpg");
});

test("background renderer keeps configured media, has a failure event and respects motion preferences", async () => {
  const source = await readFile(new URL("../src/components/welcome-page/WelcomePageBackground.tsx", import.meta.url), "utf8");
  assert.match(source, /onError=\{\(\) => setFailedMediaUrl\(mediaUrl\)\}/);
  assert.match(source, /backgroundColor: color/);
  assert.match(source, /autoPlay=\{mayAnimateVideo\}/);
  assert.match(source, /loop=\{mayAnimateVideo\}/);
  assert.match(source, /objectPosition: safePosition\(backgroundPosition\)/);
  assert.match(source, /pointer-events-none fixed inset-0/);
});

test("Welcome CMS content exposes SEO and section ordering without invalidating legacy records", () => {
  const content = {
    ...defaultWelcomePageContent,
    sectionOrder: ["steps", "hero", "features", "audiences", "cta", "footer"],
    sectionVisibility: { ...defaultWelcomePageContent.sectionVisibility, audiences: false },
  };
  assert.equal(isWelcomePageContent(content), true);
  assert.equal(isWelcomePageContent({ ...content, sectionOrder: ["hero", "hero"] }), false);
  const legacy = { ...defaultWelcomePageContent };
  delete legacy.seo;
  delete legacy.sectionOrder;
  delete legacy.sectionVisibility;
  assert.equal(isWelcomePageContent(legacy), true);
  assert.equal(resolveWelcomePageContent(legacy).seo?.title, defaultWelcomePageContent.seo.title);
});
