import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import test from "node:test";
import { validatePersonalWorkspaceTestUrl } from "./helpers/personal-workspace-postgres.mjs";

const data = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: data("export {};"), shortCircuit: true };
  if (specifier === "@/lib/prisma") return { url: new URL("./helpers/personal-workspace-postgres.mjs", import.meta.url).href, shortCircuit: true };
  if (specifier === "@/lib/consultations/timezone-core") return { url: new URL("../src/lib/consultations/timezone-core.ts", import.meta.url).href, shortCircuit: true };
  if (specifier === "@/lib/personal-workspace-academics-core") return { url: new URL("../src/lib/personal-workspace-academics-core.ts", import.meta.url).href, shortCircuit: true };
  if (specifier === "@/lib/personal-workspace-planning-core") return { url: new URL("../src/lib/personal-workspace-planning-core.ts", import.meta.url).href, shortCircuit: true };
  if (specifier === "@/lib/personal-workspace-planning") return { url: new URL("../src/lib/personal-workspace-planning.ts", import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });

const { config, integrationEnabled, prisma } = await import("./helpers/personal-workspace-postgres.mjs");
const service = await import("../src/lib/personal-workspace-academics.ts");
const integration = (name, fn) => test(name, { skip: !integrationEnabled }, fn);
let owners = [];

test("rejects remote and unrecognized PostgreSQL integration targets without connecting", () => {
  assert.throws(() => validatePersonalWorkspaceTestUrl("postgresql://crispus_workspace_test_runner:test@db.example.com/crispus_workspace_test_local"), /loopback/);
  assert.throws(() => validatePersonalWorkspaceTestUrl("postgresql://crispus_workspace_test_runner:test@127.0.0.1/production"), /not an approved/);
  assert.throws(() => validatePersonalWorkspaceTestUrl("postgresql://postgres:test@127.0.0.1/crispus_workspace_test_local"), /test role/);
});

test.before(async () => {
  if (!integrationEnabled || !prisma || !config) return;
  await prisma.$connect();
  const [database] = await prisma.$queryRaw`SELECT current_database() AS name`;
  assert.equal(database?.name, config.databaseName);
  const [guard] = await prisma.$queryRaw`SELECT to_regclass('public."_personal_workspace_test_guard"') IS NOT NULL AS guard_exists, to_regclass('public."AcademicProfile"') IS NOT NULL AS academics_exist`;
  assert.equal(guard?.guard_exists, true, "The disposable database marker table is required.");
  assert.equal(guard?.academics_exist, true, "The additive academic migration must already be installed in the isolated test database.");
  const [marker] = await prisma.$queryRaw`SELECT EXISTS (SELECT 1 FROM public."_personal_workspace_test_guard" WHERE marker = 'CRISPUS_PERSONAL_WORKSPACE_DISPOSABLE_TEST_DATABASE') AS valid`;
  assert.equal(marker?.valid, true);
});
test.after(async () => { if (prisma) await prisma.$disconnect(); });
test.afterEach(async () => { if (prisma && owners.length) await prisma.user.deleteMany({ where: { id: { in: owners } } }); owners = []; });

async function createOwner() {
  const id = `academic_it_${randomUUID().replaceAll("-", "")}`;
  await prisma.user.create({ data: { id, updatedAt: new Date() } }); owners.push(id); return id;
}

integration("academic records persist with composite owner relations and invalid links roll back", async () => {
  const owner = await createOwner();
  const year = await service.createAcademicYear(owner, { name: "Test year", startsOn: "2026-01-01", endsOn: "2026-12-31", isCurrent: true });
  assert.equal(year.ok, true, year.message);
  const course = await service.createAcademicCourse(owner, { academicYearId: year.value.id, name: "Test course" });
  assert.equal(course.ok, true, course.message);
  const failed = await service.createAcademicActivity(owner, { kind: "ASSIGNMENT", courseId: course.value.id, title: "Should roll back", taskIds: ["not-owned"], dueOn: "2026-11-30" });
  assert.equal(failed.ok, false);
  const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: owner }, select: { id: true } });
  assert.equal(await prisma.academicActivity.count({ where: { workspaceId: workspace.id, title: "Should roll back" } }), 0);
  const row = await prisma.academicYear.findFirst({ where: { id: year.value.id, workspaceId: workspace.id } });
  assert.ok(row);
});

integration("concurrent current-year writes serialize to one current academic year", async () => {
  const owner = await createOwner();
  const results = await Promise.allSettled([
    service.createAcademicYear(owner, { name: "Concurrent A", startsOn: "2026-01-01", endsOn: "2026-12-31", isCurrent: true }),
    service.createAcademicYear(owner, { name: "Concurrent B", startsOn: "2027-01-01", endsOn: "2027-12-31", isCurrent: true }),
  ]);
  const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: owner }, select: { id: true } });
  assert.ok(results.some((result) => result.status === "fulfilled" && result.value.ok));
  assert.equal(await prisma.academicYear.count({ where: { workspaceId: workspace.id, isCurrent: true, archivedAt: null } }), 1);
});

integration("cross-workspace course references are not accepted", async () => {
  const ownerA = await createOwner(); const ownerB = await createOwner();
  const year = await service.createAcademicYear(ownerB, { name: "Other year", startsOn: "2026-01-01", endsOn: "2026-12-31" });
  const course = await service.createAcademicCourse(ownerB, { academicYearId: year.value.id, name: "Private course" });
  const result = await service.createAcademicActivity(ownerA, { kind: "ASSIGNMENT", courseId: course.value.id, title: "Foreign reference" });
  assert.equal(result.ok, false);
});
