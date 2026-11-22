import { NextResponse } from "next/server";
import { requireApiUser, requireSameOriginApiRequest } from "@/lib/authorization";
import { createFinanceResource, getPersonalFinance } from "@/lib/personal-workspace-finance";
import { FINANCE_CURRENCIES, parseFinanceBudgetDraft, parseFinanceDate, parseFinanceDebtDraft, parseFinanceGoalDraft, parseFinancePositionDraft, parseFinanceRecurringDraft, parseFinanceReminderDraft, parseFinanceTransactionDraft } from "@/lib/personal-workspace-finance-core";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, max-age=0" };
const resources = ["transactions", "positions", "budgets", "goals", "debts", "recurring", "reminders"] as const;
function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers }); }
async function body(request: Request): Promise<unknown> { const raw = await request.text(); if (new TextEncoder().encode(raw).byteLength > 32_000) throw new Error("too-large"); return JSON.parse(raw); }

export async function GET(request: Request) {
  const auth = await requireApiUser(); if (auth.response) return auth.response;
  const params = new URL(request.url).searchParams;
  const allowedParams = new Set(["from", "to", "page", "pageSize", "kind", "currency", "q"]);
  if ([...params.keys()].some((key) => !allowedParams.has(key))) return json({ success: false, message: "Unsupported finance query parameter." }, 400);
  for (const key of ["from", "to", "page", "pageSize", "kind", "currency", "q"]) if (params.getAll(key).length > 1) return json({ success: false, message: "Repeated query parameters are not supported." }, 400);
  const today = new Date().toISOString().slice(0, 10);
  const from = params.get("from") ?? `${today.slice(0, 4)}-01-01`;
  const to = params.get("to") ?? today;
  if (!parseFinanceDate(from) || !parseFinanceDate(to) || from > to || (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) > 366 * 86_400_000) return json({ success: false, message: "Choose a valid date range of up to one year." }, 400);
  const pageValue = params.get("page") === null ? 1 : Number(params.get("page"));
  const sizeValue = params.get("pageSize") === null ? 25 : Number(params.get("pageSize"));
  if (!Number.isSafeInteger(pageValue) || pageValue < 1 || !Number.isSafeInteger(sizeValue) || sizeValue < 1 || sizeValue > 100) return json({ success: false, message: "Pagination is invalid." }, 400);
  if (pageValue > 100_000 || (params.get("kind") && !["INCOME", "EXPENSE", "TRANSFER", "SAVINGS_CONTRIBUTION", "SAVINGS_WITHDRAWAL", "DEBT_REPAYMENT", "ASSET_ACQUISITION", "ASSET_DISPOSAL"].includes(params.get("kind")!)) || (params.get("currency") && !FINANCE_CURRENCIES.includes(params.get("currency") as typeof FINANCE_CURRENCIES[number]))) return json({ success: false, message: "Finance filters are invalid." }, 400);
  try {
    const data = await getPersonalFinance(auth.user.id, { from, to }, { page: pageValue, pageSize: sizeValue, kind: params.get("kind") ?? undefined, currency: params.get("currency") ?? undefined, q: params.get("q") ?? undefined });
    return json({ success: true, data });
  } catch { return json({ success: false, message: "Finance records are temporarily unavailable." }, 503); }
}

export async function POST(request: Request) {
  const originFailure = requireSameOriginApiRequest(request); if (originFailure) return originFailure;
  const auth = await requireApiUser(); if (auth.response) return auth.response;
  let value: unknown; try { value = await body(request); } catch (error) { return json({ success: false, message: error instanceof Error && error.message === "too-large" ? "Request is too large." : "Invalid request body." }, error instanceof Error && error.message === "too-large" ? 413 : 400); }
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return json({ success: false, message: "Invalid request body." }, 400);
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["resource", "data"].includes(key)) || typeof input.resource !== "string" || !resources.includes(input.resource as typeof resources[number])) return json({ success: false, message: "Unsupported finance resource." }, 400);
  const parsers = { transactions: parseFinanceTransactionDraft, positions: parseFinancePositionDraft, budgets: parseFinanceBudgetDraft, goals: parseFinanceGoalDraft, debts: parseFinanceDebtDraft, recurring: parseFinanceRecurringDraft, reminders: parseFinanceReminderDraft };
  const parsed = parsers[input.resource as typeof resources[number]](input.data);
  if (!parsed.success) return json({ success: false, message: parsed.message }, 400);
  try { const created = await createFinanceResource(auth.user.id, input.resource as typeof resources[number], parsed.value as unknown as Record<string, unknown>); return json({ success: true, data: created }, 201); }
  catch { return json({ success: false, message: "Unable to save this finance record. Check the values and try again." }, 503); }
}
