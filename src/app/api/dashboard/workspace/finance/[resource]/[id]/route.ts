import { NextResponse } from "next/server";
import { requireApiUser, requireSameOriginApiRequest } from "@/lib/authorization";
import { updateFinanceResource } from "@/lib/personal-workspace-finance";
import { parseFinanceUpdate } from "@/lib/personal-workspace-finance-core";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ resource: string; id: string }> };
const resources = ["transactions", "positions", "budgets", "goals", "debts", "recurring", "reminders"] as const;
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
async function readBody(request: Request): Promise<unknown> { const raw = await request.text(); if (new TextEncoder().encode(raw).byteLength > 16_000) throw new Error("Request too large."); return JSON.parse(raw); }

export async function PATCH(request: Request, context: Context) {
  const originFailure = requireSameOriginApiRequest(request); if (originFailure) return originFailure;
  const auth = await requireApiUser(); if (auth.response) return auth.response;
  const { resource, id } = await context.params;
  if (!resources.includes(resource as typeof resources[number]) || !id || id.length > 128) return json({ success: false, message: "Finance record not found." }, 404);
  let body: unknown; try { body = await readBody(request); } catch { return json({ success: false, message: "Invalid request body." }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.getPrototypeOf(body) !== Object.prototype || Object.keys(body).some((key) => key !== "data")) return json({ success: false, message: "Invalid request body." }, 400);
  const parsed = parseFinanceUpdate(resource, (body as Record<string, unknown>).data);
  if (!parsed.success) return json({ success: false, message: parsed.message }, 400);
  try { const result = await updateFinanceResource(auth.user.id, resource as typeof resources[number], id, parsed.value); if (!result) return json({ success: false, message: "Finance record not found." }, 404); if ("conflict" in result && result.conflict) return json({ success: false, message: "This record changed elsewhere. Refresh before retrying." }, 409); return json({ success: true, data: result }); }
  catch { return json({ success: false, message: "Unable to update this finance record." }, 503); }
}

export async function DELETE(request: Request, context: Context) {
  const originFailure = requireSameOriginApiRequest(request); if (originFailure) return originFailure;
  const auth = await requireApiUser(); if (auth.response) return auth.response;
  const { resource, id } = await context.params;
  if (!resources.includes(resource as typeof resources[number]) || !id || id.length > 128) return json({ success: false, message: "Finance record not found." }, 404);
  try { const result = await updateFinanceResource(auth.user.id, resource as typeof resources[number], id, {}, true); return result ? json({ success: true, data: result }) : json({ success: false, message: "Finance record not found." }, 404); }
  catch { return json({ success: false, message: "Unable to archive this finance record." }, 503); }
}
