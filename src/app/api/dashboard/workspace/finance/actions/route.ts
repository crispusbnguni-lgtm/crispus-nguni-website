import { NextResponse } from "next/server";
import { requireApiUser, requireSameOriginApiRequest } from "@/lib/authorization";
import { createDebtPayment, createGoalMovement, createNextRecurringOccurrence } from "@/lib/personal-workspace-finance";

export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
export async function POST(request: Request) {
  const originFailure = requireSameOriginApiRequest(request); if (originFailure) return originFailure;
  const auth = await requireApiUser(); if (auth.response) return auth.response;
  let input: unknown; try { const text = await request.text(); if (new TextEncoder().encode(text).byteLength > 8_000) return json({ success: false, message: "Request is too large." }, 413); input = JSON.parse(text); } catch { return json({ success: false, message: "Invalid request body." }, 400); }
  if (!isRecord(input) || typeof input.action !== "string") return json({ success: false, message: "Invalid finance action." }, 400);
  try {
    if (input.action === "goalMovement" && Object.keys(input).every((key) => ["action", "goalId", "kind", "amount", "occurredOn", "label"].includes(key)) && typeof input.goalId === "string" && (input.kind === "CONTRIBUTION" || input.kind === "WITHDRAWAL") && typeof input.amount === "string" && typeof input.occurredOn === "string" && (input.label === undefined || typeof input.label === "string")) {
      const result = await createGoalMovement(auth.user.id, input.goalId, { kind: input.kind, amount: input.amount, occurredOn: input.occurredOn, label: input.label as string | undefined });
      return result ? json({ success: true, data: result }, 201) : json({ success: false, message: "Goal not found." }, 404);
    }
    if (input.action === "debtPayment" && Object.keys(input).every((key) => ["action", "debtId", "amount", "principalAmount", "interestAmount", "occurredOn", "label"].includes(key)) && typeof input.debtId === "string" && ["amount", "principalAmount", "interestAmount", "occurredOn"].every((key) => typeof input[key] === "string") && (input.label === undefined || typeof input.label === "string")) {
      const result = await createDebtPayment(auth.user.id, input.debtId, { amount: input.amount as string, principalAmount: input.principalAmount as string, interestAmount: input.interestAmount as string, occurredOn: input.occurredOn as string, label: input.label as string | undefined });
      return result ? json({ success: true, data: result }, 201) : json({ success: false, message: "Debt not found." }, 404);
    }
    if (input.action === "recurringOccurrence" && Object.keys(input).length === 2 && typeof input.scheduleId === "string") {
      const result = await createNextRecurringOccurrence(auth.user.id, input.scheduleId);
      return result ? json({ success: true, data: result }, 201) : json({ success: false, message: "Active recurring schedule not found." }, 404);
    }
    return json({ success: false, message: "Finance action fields are invalid." }, 400);
  } catch { return json({ success: false, message: "Unable to complete this finance action. Refresh and verify the record before retrying." }, 409); }
}
