import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readProjectFile(relativePath) {
  return readFile(path.join(projectRoot, relativePath), "utf8");
}

test("Super Admin navigation has one canonical Display Studio destination", async () => {
  const navigation = await readProjectFile("src/components/admin/AdminNavigation.tsx");
  const adminPage = await readProjectFile("src/app/admin/page.tsx");
  const accountsPage = await readProjectFile("src/app/admin/accounts/page.tsx");

  assert.equal((navigation.match(/href: "\/admin#display-studio"/g) ?? []).length, 1);
  assert.doesNotMatch(adminPage, /href="\/admin#display-studio"/);
  assert.doesNotMatch(accountsPage, /href="\/admin#display-studio"/);
  assert.match(navigation, /label: "Display Studio"/);
});

test("navigation links resolve only to existing Admin and workspace destinations", async () => {
  const navigation = await readProjectFile("src/components/admin/AdminNavigation.tsx");
  const destinations = [
    ["/admin", "src/app/admin/page.tsx"],
    ["/admin/accounts", "src/app/admin/accounts/page.tsx"],
    ["/admin/sessions", "src/app/admin/sessions/page.tsx"],
    ["/admin/backgrounds", "src/app/admin/backgrounds/page.tsx"],
    ["/admin/backgrounds/welcome-page", "src/app/admin/backgrounds/welcome-page/page.tsx"],
    ["/admin/audit", "src/app/admin/audit/page.tsx"],
    ["/admin/operations", "src/app/admin/operations/page.tsx"],
    ["/dashboard/workspace", "src/app/dashboard/workspace/page.tsx"],
  ];

  for (const [href, file] of destinations) {
    assert.ok(navigation.includes(`href: "${href}"`) || navigation.includes(`href="${href}"`), `${href} is in the menu`);
    await readProjectFile(file);
  }

  assert.match(navigation, /href: "\/admin#display-studio"/);
  await readProjectFile("src/app/admin/page.tsx");
});

test("admin navigation is mounted behind server-side Super Admin authorization", async () => {
  const layout = await readProjectFile("src/app/admin/layout.tsx");
  const dashboardLayout = await readProjectFile("src/app/dashboard/layout.tsx");
  const dashboardPage = await readProjectFile("src/app/dashboard/page.tsx");

  assert.match(layout, /await requireSuperAdmin\(\)/);
  assert.match(layout, /<AdminNavigation administratorName=/);
  assert.match(layout, /\{children\}/);
  assert.doesNotMatch(dashboardLayout, /AdminNavigation/);
  assert.match(dashboardPage, /href="\/dashboard\/display-studio"/);
});

test("navigation groups stay responsive and collapsible on narrow and wide screens", async () => {
  const navigation = await readProjectFile("src/components/admin/AdminNavigation.tsx");
  const shellStyles = await readProjectFile("src/components/admin/AdminShell.module.css");

  assert.match(navigation, /animate=\{\{ width: collapsed \? 92 : 272 \}\}/);
  assert.match(navigation, /setCollapsed\(\(value\) => !value\)/);
  assert.match(shellStyles, /:focus-visible/);
  assert.match(navigation, /aria-label="Super Admin navigation"/);
  assert.match(navigation, /aria-expanded=\{mobileOpen\}/);
  assert.match(navigation, /aria-controls="admin-mobile-navigation"/);
  assert.match(navigation, /if \(mobile\) setMobileOpen\(false\);/);
  assert.match(navigation, /Escape/);
  assert.match(navigation, /event\.shiftKey/);
  assert.match(navigation, /pathname === "\/admin" && hash === "#display-studio"/);
  assert.match(navigation, /<AnimatePresence>/);
  assert.match(navigation, /useAdminReducedMotion\(\)/);
  assert.equal((navigation.match(/label: "Display Studio"/g) ?? []).length, 1);
});

test("overview metrics and activity come from live data with independent unavailable states", async () => {
  const dashboard = await readProjectFile("src/app/admin/page.tsx");
  assert.match(dashboard, /prisma\.user\.count\(\)/);
  assert.match(dashboard, /prisma\.portfolioSite\.count\(\{ where: \{ published: true \} \}\)/);
  assert.match(dashboard, /prisma\.userSession\.count\(/);
  assert.match(dashboard, /prisma\.auditLog\.findMany\(/);
  assert.match(dashboard, /Promise\.allSettled\(/);
  assert.match(dashboard, /Unavailable/);
  assert.doesNotMatch(dashboard, /metadata:\s*true/);
  assert.match(dashboard, /<LiquidLensSurface/);
  assert.match(dashboard, /<AdminReveal/);
});

test("Admin wallpaper remains visible through genuine glass surfaces in both themes", async () => {
  const shell = await readProjectFile("src/components/admin/AdminShell.module.css");
  const dashboard = await readProjectFile("src/app/admin/page.tsx");
  const layout = await readProjectFile("src/app/admin/layout.tsx");

  assert.match(layout, /dashboardBackground/);
  assert.match(shell, /--admin-canvas: rgba\(5, 8, 16, 0\.2\)/);
  assert.match(shell, /--admin-panel: rgba\(14, 20, 33, 0\.54\)/);
  assert.match(shell, /--admin-canvas: rgba\(241, 245, 251, 0\.36\)/);
  assert.match(shell, /data-reduce-transparency/);
  assert.match(dashboard, /<LiquidLensSurface radius=\{30\} intensity="medium" className=\{styles\.heroSurface\}>/);
  assert.match(dashboard, /<LiquidLensSurface radius=\{22\} intensity="subtle" className=\{styles\.actionSurface\}>/);
  assert.match(dashboard, /<LiquidLensSurface\s+radius=\{24\}/);
});
