import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const data = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
globalThis.__financeApi = { user: { id: "owner-session" }, originFailure: false, calls: [] };
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: data("export {};"), shortCircuit: true };
  if (specifier === "next/server") return { url: data("export const NextResponse={json:(body,init)=>Response.json(body,init)};"), shortCircuit: true };
  if (specifier === "@/lib/authorization") return { url: data(`export async function requireApiUser(){const s=globalThis.__financeApi;return s.user?{user:s.user,response:null}:{user:null,response:Response.json({success:false},{status:401})}} export function requireSameOriginApiRequest(){return globalThis.__financeApi.originFailure?Response.json({success:false},{status:403}):null;}`), shortCircuit: true };
  if (specifier === "@/lib/personal-workspace-finance") return { url: data(`export async function getPersonalFinance(...args){globalThis.__financeApi.calls.push({name:'get',args});return {workspace:null,summary:[],transactions:{items:[],total:0,page:1,pageSize:25},positions:[],budgets:[],goals:[],debts:[],recurring:[],reminders:[],history:[]}} export async function createFinanceResource(...args){globalThis.__financeApi.calls.push({name:'create',args});return {id:'created'}} export async function updateFinanceResource(...args){globalThis.__financeApi.calls.push({name:'update',args});return {id:args[2]}} export async function createGoalMovement(...args){globalThis.__financeApi.calls.push({name:'goal',args});return {id:'movement'}} export async function createDebtPayment(...args){globalThis.__financeApi.calls.push({name:'debt',args});return {id:'payment'}} export async function createNextRecurringOccurrence(...args){globalThis.__financeApi.calls.push({name:'recurring',args});return {id:'occurrence'}}`), shortCircuit: true };
  if (specifier === "@/lib/personal-workspace-finance-core") return { url: new URL("../src/lib/personal-workspace-finance-core.ts", import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const collection = await import("../src/app/api/dashboard/workspace/finance/route.ts");
const recordRoute = await import("../src/app/api/dashboard/workspace/finance/[resource]/[id]/route.ts");
const actions = await import("../src/app/api/dashboard/workspace/finance/actions/route.ts");
const req = (url, method = "GET", payload, origin = "https://app.example.test") => new Request(url, { method, headers: { ...(origin ? { origin } : {}), "content-type": "application/json" }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
const ctx = (resource, id) => ({ params: Promise.resolve({ resource, id }) });
test.beforeEach(() => { globalThis.__financeApi = { user: { id: "owner-session" }, originFailure: false, calls: [] }; });

test("finance reads require an authenticated session, reject owner selectors, and bind queries to the session owner", async () => {
  globalThis.__financeApi.user = null;
  assert.equal((await collection.GET(req("https://app.example.test/api/finance?from=2026-01-01&to=2026-11-17"))).status, 401);
  assert.equal(globalThis.__financeApi.calls.length, 0);
  globalThis.__financeApi.user = { id: "owner-session" };
  assert.equal((await collection.GET(req("https://app.example.test/api/finance?from=2026-01-01&to=2026-11-17&ownerUserId=victim"))).status, 400);
  assert.equal((await collection.GET(req("https://app.example.test/api/finance?from=2026-01-01&from=2026-02-01&to=2026-11-17"))).status, 400);
  const response = await collection.GET(req("https://app.example.test/api/finance?from=2026-01-01&to=2026-11-17&currency=KES"));
  assert.equal(response.status, 200);
  assert.equal(globalThis.__financeApi.calls[0].args[0], "owner-session");
  assert.equal(globalThis.__financeApi.calls[0].args[2].currency, "KES");
});

test("finance mutations enforce same-origin and reject browser-supplied owner fields", async () => {
  globalThis.__financeApi.originFailure = true;
  assert.equal((await collection.POST(req("https://app.example.test/api/finance", "POST", {}))).status, 403);
  assert.equal(globalThis.__financeApi.calls.length, 0);
  globalThis.__financeApi.originFailure = false;
  assert.equal((await collection.POST(req("https://app.example.test/api/finance", "POST", { resource: "transactions", userId: "victim", data: {} }))).status, 400);
  const payload = { resource: "transactions", data: { kind: "EXPENSE", quality: "ACTUAL", amount: "10.25", currency: "KES", occurredOn: "2026-11-17", label: "Food", category: "Home" } };
  assert.equal((await collection.POST(req("https://app.example.test/api/finance", "POST", payload))).status, 201);
  assert.equal(globalThis.__financeApi.calls[0].args[0], "owner-session");
  assert.equal(globalThis.__financeApi.calls[0].args[2].amount, "10.25");
});

test("finance record updates and archives pass only authenticated owner and route identifiers", async () => {
  const response = await recordRoute.PATCH(req("https://app.example.test/api/finance/positions/position-a", "PATCH", { data: { value: "99.50", currency: "USD", valuedOn: "2026-11-17", expectedRevision: 4 } }), ctx("positions", "position-a"));
  assert.equal(response.status, 200);
  assert.equal(globalThis.__financeApi.calls[0].args[0], "owner-session");
  assert.equal(globalThis.__financeApi.calls[0].args[2], "position-a");
  assert.equal((await recordRoute.DELETE(req("https://app.example.test/api/finance/positions/position-a", "DELETE"), ctx("positions", "position-a"))).status, 200);
  assert.equal(globalThis.__financeApi.calls[1].args[0], "owner-session");
});

test("goal, debt and recurring actions use the authenticated owner and reject forged identity", async () => {
  const bad = await actions.POST(req("https://app.example.test/api/finance/actions", "POST", { action: "goalMovement", ownerUserId: "victim", goalId: "g", kind: "CONTRIBUTION", amount: "1", occurredOn: "2026-11-17" }));
  assert.equal(bad.status, 400);
  const good = await actions.POST(req("https://app.example.test/api/finance/actions", "POST", { action: "goalMovement", goalId: "g", kind: "CONTRIBUTION", amount: "1", occurredOn: "2026-11-17" }));
  assert.equal(good.status, 201);
  assert.equal(globalThis.__financeApi.calls[0].args[0], "owner-session");
});
