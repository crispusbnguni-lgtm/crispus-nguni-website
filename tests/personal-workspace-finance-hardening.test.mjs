import assert from "node:assert/strict";
import test from "node:test";
import { estimateMonthlyDebtPayoff, parseFinanceAmount, parseFinanceTransactionDraft } from "../src/lib/personal-workspace-finance-core.ts";

test("finance amounts stay within PostgreSQL DECIMAL(20,4) and currency precision", () => {
  assert.equal(parseFinanceAmount("9999999999999999.99", "KES"), 999999999999999999n);
  assert.throws(() => parseFinanceAmount("10000000000000000", "KES"), /valid/i);
  assert.throws(() => parseFinanceAmount("1.001", "KES"), /valid/i);
});

test("estimated cash-flow entries remain explicit and are not coerced into actual records", () => {
  const parsed = parseFinanceTransactionDraft({ kind: "INCOME", quality: "ESTIMATE", amount: "125.50", currency: "KES", occurredOn: "2026-11-20", label: "Variable income", category: "Work" });
  assert.equal(parsed.success, true);
  assert.equal(parsed.value.quality, "ESTIMATE");
  assert.equal(parsed.value.kind, "INCOME");
  assert.equal(parseFinanceTransactionDraft({ ...parsed.value, quality: "ACTUAL" }).value.quality, "ACTUAL");
});

test("debt payoff estimate uses bounded integer-minor-unit monthly arithmetic", () => {
  const result = estimateMonthlyDebtPayoff({ balance: "1000.00", payment: "100.00", annualRatePercent: "12", currency: "USD", fixedRate: true, monthlyFrequency: true });
  assert.deepEqual(result, { months: 11, totalInterestMinor: 5898n });
  assert.equal(estimateMonthlyDebtPayoff({ balance: "1000", payment: "8", annualRatePercent: "12", currency: "USD", fixedRate: true, monthlyFrequency: true }), null);
  assert.equal(estimateMonthlyDebtPayoff({ balance: "1000", payment: "100", annualRatePercent: "12", currency: "USD", fixedRate: false, monthlyFrequency: true }), null);
  assert.equal(estimateMonthlyDebtPayoff({ balance: "1000", payment: "100", annualRatePercent: "12", currency: "USD", fixedRate: true, monthlyFrequency: false }), null);
  assert.equal(estimateMonthlyDebtPayoff({ balance: "1000", payment: "100", annualRatePercent: "12", currency: "USD", fixedRate: true, monthlyFrequency: true, maxMonths: 1201 }), null);
});
