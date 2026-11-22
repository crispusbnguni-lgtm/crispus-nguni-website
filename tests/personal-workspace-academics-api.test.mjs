import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
const data = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
globalThis.__academicsRoutes = { user: { id: "verified-owner" }, originFailure: false, calls: [] };
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: data("export {};"), shortCircuit: true };
  if (specifier === "next/server") return { url: data("export const NextResponse={json:(body,init)=>Response.json(body,init)};"), shortCircuit: true };
  if (specifier === "@/lib/personal-workspace-api") return { url: data(`export const WORKSPACE_NO_STORE={'Cache-Control':'no-store'}; export async function workspaceApiUser(request,mutation=false){const s=globalThis.__academicsRoutes;if(mutation&&s.originFailure)return {user:null,response:Response.json({success:false},{status:403})};return s.user?{user:s.user,response:null}:{user:null,response:Response.json({success:false},{status:401})};} export async function workspaceJson(request){try{const text=await request.text();if(text.length>32000)return {success:false,response:Response.json({success:false},{status:413})};return {success:true,value:JSON.parse(text)};}catch{return {success:false,response:Response.json({success:false},{status:400})};}} export function workspaceResult(result){return result?.ok===false?Response.json({success:false,...result},{status:result.status}):Response.json({success:true,data:result?.value??result});} export function workspaceError(){return Response.json({success:false},{status:500});}`), shortCircuit: true };
  if (specifier === "@/lib/personal-workspace-academics") {
    const names = ["academicDashboard", "createAcademicActivity", "createAcademicCourse", "createAcademicTerm", "createAcademicYear", "createTimetableRule", "deleteTimetableException", "getAcademicCalendar", "getAcademicProfile", "listAcademicActivities", "listAcademicCourses", "listAcademicTerms", "listAcademicYears", "listTimetableRules", "saveAcademicProfile", "saveTimetableException", "setAcademicActivityLink", "updateAcademicActivity", "updateAcademicCourse", "updateAcademicTerm", "updateAcademicYear", "updateTimetableRule"];
    return { url: data(names.map((name) => `export async function ${name}(...args){globalThis.__academicsRoutes.calls.push({name:"${name}",args});return {ok:true,value:{name:"${name}",args}};}`).join("\n")), shortCircuit: true };
  }
  return nextResolve(specifier, context);
} });
const routes = await import("../src/lib/personal-workspace-academics-routes.ts");
const req = (url, method = "GET", payload, origin = "https://app.test") => new Request(url, { method, headers: { ...(origin ? { origin } : {}), "content-type": "application/json" }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
const ctx = (resource, id) => ({ params: Promise.resolve({ resource, ...(id ? { id } : {}) }) });
test.beforeEach(() => { globalThis.__academicsRoutes = { user: { id: "verified-owner" }, originFailure: false, calls: [] }; });

test("unauthenticated reads and writes stop before academic persistence", async () => {
  globalThis.__academicsRoutes.user = null;
  assert.equal((await routes.getAcademicResource(req("https://app.test/api/academics/years"), ctx("years"))).status, 401);
  assert.equal((await routes.postAcademicResource(req("https://app.test/api/academics/years", "POST", {}), ctx("years"))).status, 401);
  assert.equal(globalThis.__academicsRoutes.calls.length, 0);
});

test("same-origin policy blocks academic mutations", async () => {
  globalThis.__academicsRoutes.originFailure = true;
  assert.equal((await routes.postAcademicResource(req("https://app.test/api/academics/years", "POST", { name: "Year" }), ctx("years"))).status, 403);
  assert.equal(globalThis.__academicsRoutes.calls.length, 0);
});

test("ownership fields and repeated query parameters are rejected", async () => {
  assert.equal((await routes.postAcademicResource(req("https://app.test/api/academics/years", "POST", { userId: "other", name: "Year" }), ctx("years"))).status, 400);
  assert.equal((await routes.getAcademicResource(req("https://app.test/api/academics/terms?yearId=a&yearId=b"), ctx("terms"))).status, 400);
  assert.equal((await routes.getAcademicResource(req("https://app.test/api/academics/terms?ownerUserId=other"), ctx("terms"))).status, 400);
  assert.equal((await routes.deleteAcademicResource(req("https://app.test/api/academics/years/y", "DELETE", { expectedRevision: 0, userId: "other" }), ctx("years", "y"))).status, 400);
  assert.equal(globalThis.__academicsRoutes.calls.length, 0);
});

test("activity resource selects its server-defined kind and uses the verified actor", async () => {
  const response = await routes.postAcademicResource(req("https://app.test/api/academics/assignments", "POST", { kind: "EXAM", courseId: "course-a", title: "Paper" }), ctx("assignments"));
  assert.equal(response.status, 200);
  const call = globalThis.__academicsRoutes.calls[0];
  assert.equal(call.name, "createAcademicActivity");
  assert.equal(call.args[0], "verified-owner");
  assert.equal(call.args[1].kind, "ASSIGNMENT");
});

test("invalid academic route names do not dispatch to persistence", async () => {
  assert.equal((await routes.postAcademicResource(req("https://app.test/api/academics/nope", "POST", {}), ctx("nope"))).status, 404);
  assert.equal(globalThis.__academicsRoutes.calls.length, 0);
});

test("calendar requires a bounded date range and uses the authenticated owner", async () => {
  assert.equal((await routes.getAcademicResource(req("https://app.test/api/academics/calendar?from=2026-11-01"), ctx("calendar"))).status, 400);
  assert.equal((await routes.getAcademicResource(req("https://app.test/api/academics/calendar?from=2026-11-01&from=2026-11-02&to=2026-11-30"), ctx("calendar"))).status, 400);
  assert.equal((await routes.getAcademicResource(req("https://app.test/api/academics/calendar?from=2026-11-01&to=2026-11-30&ownerUserId=other"), ctx("calendar"))).status, 400);
  await routes.getAcademicResource(req("https://app.test/api/academics/calendar?from=2026-11-01&to=2026-11-30"), ctx("calendar"));
  assert.deepEqual(globalThis.__academicsRoutes.calls[0], { name: "getAcademicCalendar", args: ["verified-owner", "2026-11-01", "2026-11-30"] });
  assert.equal(globalThis.__academicsRoutes.calls.length, 1);
});

test("link endpoint accepts only a target type and ID and derives owner server-side", async () => {
  const response = await routes.changeAcademicActivityLink(req("https://app.test/api/academics/activities/a/links", "POST", { type: "task", targetId: "task-a", workspaceId: "forged" }), { params: Promise.resolve({ id: "activity-a" }) }, true);
  assert.equal(response.status, 400);
  const good = await routes.changeAcademicActivityLink(req("https://app.test/api/academics/activities/a/links", "POST", { type: "task", targetId: "task-a" }), { params: Promise.resolve({ id: "activity-a" }) }, true);
  assert.equal(good.status, 200);
  assert.deepEqual(globalThis.__academicsRoutes.calls[0].args, ["verified-owner", "activity-a", { type: "task", targetId: "task-a" }, true]);
});
