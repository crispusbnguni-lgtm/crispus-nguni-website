import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const navbarPath = new URL("../src/components/navigation/Navbar.tsx", import.meta.url);
const controlPath = new URL("../src/components/navigation/DisplayStudioControlCentre.tsx", import.meta.url);
const glassPath = new URL("../src/components/ui/LiquidLensSurface.tsx", import.meta.url);

test("public Navbar exposes one Display Studio control per responsive navigation context", async () => {
  const source = await readFile(navbarPath, "utf8");
  assert.equal((source.match(/<DisplayStudioControlCentre\b/g) ?? []).length, 2);
  assert.match(source, /<DisplayStudioControlCentre className="navbar-icon-control"/);
  assert.match(source, /<DisplayStudioControlCentre\s+mobile/);
  assert.doesNotMatch(source, /href="\/dashboard\/display-studio"/);
});

test("Control Centre opens a compact personal preference dialog using Liquid Glass", async () => {
  const [source, glass] = await Promise.all([
    readFile(controlPath, "utf8"),
    readFile(glassPath, "utf8"),
  ]);
  assert.match(source, /aria-haspopup="dialog"/);
  assert.match(source, /<dialog/);
  assert.match(source, /dialog\.showModal\(\)/);
  assert.match(source, /setOpen\(\(current\) => !current\)/);
  assert.match(source, /onClose\?\./);
  assert.match(source, /reader\.updatePreference\("colorMode"/);
  assert.match(source, /reader\.updatePreference\("fontFamily"/);
  assert.match(source, /reader\.updatePreference\("glassLevel"/);
  assert.match(source, /reader\.resetPreferences\(\)/);
  assert.doesNotMatch(source, /href="\/dashboard\/display-studio"/);
  assert.match(source, /<LiquidLensSurface/);
  assert.match(glass, /from "@samasante\/liquid-glass"/);
});

test("shared navigation is icon-only with accessible route labels and focusable tooltips", async () => {
  const source = await readFile(navbarPath, "utf8");
  assert.match(source, /from "lucide-react"/);
  assert.match(source, /aria-label=\{label\}/);
  assert.match(source, /title=\{label\}/);
  assert.match(source, /data-tooltip=\{label\}/);
  assert.match(source, /aria-current=\{active \? "page"/);
  assert.match(source, /label: "Explore portfolios"/);
  assert.match(source, /label: "About Crispus"/);
  assert.match(source, /<IconLink[\s\S]*?href="\/login"[\s\S]*?label="Sign in"/);
  assert.match(source, /label="Create account"/);
  assert.doesNotMatch(source, />\s*Display Studio\s*</);
});
