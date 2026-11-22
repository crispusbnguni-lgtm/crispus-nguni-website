import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("cross-account workspace inspection is Super Admin-only, dynamic, read-only and audited", async () => {
  const page = await readFile(new URL("../src/app/admin/users/[id]/workspace/page.tsx", import.meta.url), "utf8");
  assert.match(page, /await requireSuperAdmin\(\)/);
  assert.match(page, /ADMIN_ACCOUNT_VIEWED/);
  assert.match(page, /writeAdminAudit\(actor/);
  assert.match(page, /targetType: "User"/);
  assert.match(page, /force-dynamic/);
  assert.match(page, /getPersonalWorkspaceOverview\(user\.id\)/);
  assert.match(page, /getNutritionDashboard\(user\.id\)/);
  assert.match(page, /getPersonalFinance\(user\.id/);
  assert.match(page, /listWorkspaceDatabaseRecords\(user\.id/);
  assert.match(page, /encrypted contents are not exposed/);
  assert.doesNotMatch(page, /createWorkspace|updateWorkspace|deleteWorkspace|saveAcademic|setSession/);

  const accountPage = await readFile(new URL("../src/app/admin/users/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(accountPage, /View Personal Workspace · audited read-only/);
});

test("Super Admin background uploads create enabled shared options and user catalogue exposes enabled options", async () => {
  const upload = await readFile(new URL("../src/app/api/admin/backgrounds/upload/route.ts", import.meta.url), "utf8");
  assert.match(upload, /requireApiSuperAdmin/);
  assert.match(upload, /requireSameOriginApiRequest/);
  assert.match(upload, /backgroundOption\.create/);
  assert.match(upload, /enabled, isDefault/);
  assert.match(upload, /ADMIN_BACKGROUND_MEDIA_UPLOADED/);
  assert.match(upload, /catch \(cause\)/);
  assert.match(upload, /storage\.from\("portfolio-backgrounds"\)\.remove/);

  const userOptions = await readFile(new URL("../src/app/api/background-options/route.ts", import.meta.url), "utf8");
  assert.match(userOptions, /where: \{ enabled: true \}/);
  assert.match(userOptions, /Cache-Control.*no-store/);

  const editor = await readFile(new URL("../src/app/admin/backgrounds/page.tsx", import.meta.url), "utf8");
  assert.match(editor, /added to the enabled backgrounds users can choose from/);
  assert.match(editor, /Update published background/);

  const portfolioEditor = await readFile(new URL("../src/app/dashboard/portfolio/PortfolioEditor.tsx", import.meta.url), "utf8");
  assert.match(portfolioEditor, /Refresh available backgrounds/);
  assert.match(portfolioEditor, /refreshAvailableBackgrounds/);
});
