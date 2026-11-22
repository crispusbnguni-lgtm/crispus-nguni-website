import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PUBLIC_SITE_PAGES,
  getPublicSitePageContent,
  isPublicSitePageContent,
  isPublicSitePageKey,
} from "../src/lib/public-site-pages.ts";

test("all public page defaults are complete and structurally valid", () => {
  for (const [key, content] of Object.entries(DEFAULT_PUBLIC_SITE_PAGES)) {
    assert.equal(isPublicSitePageKey(key), true);
    assert.equal(isPublicSitePageContent(content), true, `${key} default should validate`);
  }
});

test("public renderer reads only a valid published page and never draft content", () => {
  const published = { ...DEFAULT_PUBLIC_SITE_PAGES.about, title: "Published" };
  const draft = { ...DEFAULT_PUBLIC_SITE_PAGES.about, title: "PRIVATE DRAFT" };
  const stored = { __cms: { pages: { about: { published, draft } } } };
  assert.equal(getPublicSitePageContent(stored, "about").title, "Published");
  assert.equal(getPublicSitePageContent({ __cms: { pages: { about: { draft } } } }, "about").title, DEFAULT_PUBLIC_SITE_PAGES.about.title);
});

test("page validation rejects unsafe media, destinations, contact details and malformed sections", () => {
  const base = DEFAULT_PUBLIC_SITE_PAGES.contact;
  assert.equal(isPublicSitePageContent({ ...base, backgroundImage: "javascript:alert(1)" }), false);
  assert.equal(isPublicSitePageContent({ ...base, ctaHref: "//attacker.test" }), false);
  assert.equal(isPublicSitePageContent({ ...base, contactEmail: "not-an-email" }), false);
  assert.equal(isPublicSitePageContent({ ...base, sections: [{ ...base.sections[0], visible: "yes" }] }), false);
  assert.equal(isPublicSitePageContent({ ...base, internalNote: "must not be accepted" }), false);
});

test("page-level and section media include validated focal positions", () => {
  const base = DEFAULT_PUBLIC_SITE_PAGES.about;
  const configured = {
    ...base,
    backgroundImage: "https://media.example/page.jpg",
    backgroundPosition: "right center",
    sections: base.sections.map((section, index) => index === 0
      ? { ...section, mediaUrl: "https://media.example/section.jpg" }
      : section),
  };
  assert.equal(isPublicSitePageContent(configured), true);
  assert.equal(isPublicSitePageContent({ ...configured, backgroundPosition: "url(javascript:alert(1))" }), false);
  assert.equal(isPublicSitePageContent({ ...configured, sections: [{ ...configured.sections[0], mediaUrl: "javascript:alert(1)" }, ...configured.sections.slice(1)] }), false);
});

test("legacy published page JSON without focal-position or section-media fields remains readable", () => {
  const base = DEFAULT_PUBLIC_SITE_PAGES.about;
  const legacy = { ...base };
  delete legacy.backgroundPosition;
  legacy.sections = base.sections.map((section) => {
  const legacySection = { ...section };
  delete legacySection.mediaUrl;
  return legacySection;
});
  assert.equal(isPublicSitePageContent(legacy), true);
  assert.equal(getPublicSitePageContent({ __cms: { pages: { about: { published: legacy } } } }, "about").title, legacy.title);
});
