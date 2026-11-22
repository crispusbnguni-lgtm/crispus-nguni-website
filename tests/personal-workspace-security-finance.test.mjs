import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { analyzePasswordCandidate, findPwnedPasswordCount, generateSecurePassword } from "../src/lib/personal-workspace-security-core.ts";
import { financeBudgetUsage, financeGoalProgress, formatFinanceAmount, parseFinanceAmount, summarizeFinance } from "../src/lib/personal-workspace-finance-core.ts";
import { parseFinanceBudgetDraft, parseFinanceDate, parseFinanceDebtDraft, parseFinanceGoalDraft, parseFinancePositionDraft, parseFinanceRecurringDraft, parseFinanceReminderDraft, parseFinanceTransactionDraft, parseFinanceUpdate } from "../src/lib/personal-workspace-finance-core.ts";

test("password analyser returns only heuristic metadata and never echoes the candidate", () => {
  const candidate = "A-unique-example-passphrase-724!";
  const result = analyzePasswordCandidate(candidate);
  assert.equal(result.length, candidate.length);
  assert.equal(result.rating, "Good");
  assert.equal(JSON.stringify(result).includes(candidate), false);
  assert.ok(result.recommendations.some((item) => item.includes("password reuse")));
});

test("password generator uses available crypto, enforces length and selected character groups", () => {
  const password = generateSecurePassword({ length: 24, symbols: false });
  assert.equal(password.length, 24);
  assert.match(password, /[a-z]/);
  assert.match(password, /[A-Z]/);
  assert.match(password, /[0-9]/);
  assert.doesNotMatch(password, /[^A-Za-z0-9]/);
  assert.equal(generateSecurePassword({ length: 1, lowercase: false, uppercase: false, numbers: true, symbols: false }).length, 12);
  assert.throws(() => generateSecurePassword({ length: 20, lowercase: false, uppercase: false, numbers: false, symbols: false }), /at least one/);
});

test("HIBP range response parser matches only a valid SHA-1 suffix and returns its count", () => {
  const suffix = "A".repeat(35);
  assert.equal(findPwnedPasswordCount(`${suffix}:42\n${"B".repeat(35)}:7`, suffix), 42);
  assert.equal(findPwnedPasswordCount(`${suffix}:42`, "not-a-sha1-suffix"), 0);
  assert.equal(findPwnedPasswordCount(`${suffix}:bad`, suffix), 0);
});

test("password analyser rejects empty candidates and warns against using important passwords", () => {
  const result = analyzePasswordCandidate("");
  assert.equal(result.score, 0);
  assert.equal(result.rating, "No candidate");
  assert.ok(result.recommendations[0].includes("currently use"));
  const predictable = analyzePasswordCandidate("password1234");
  assert.equal(predictable.predictableExample, true);
  assert.equal(predictable.repeatedRun, false);
});

test("candidate analysis stays local and optional breach lookup sends only the privacy-preserving hash prefix", async () => {
  const source = await readFile(new URL("../src/components/workspace/WorkspaceSecurity.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /localStorage|sessionStorage|console\./);
  assert.match(source, /autoComplete="off"/);
  assert.match(source, /setCandidate\(""\)/);
  assert.match(source, /crypto\.subtle\.digest\("SHA-1"/);
  assert.match(source, /api\.pwnedpasswords\.com\/range\/\$\{hash\.slice\(0, 5\)\}/);
  assert.doesNotMatch(source, /body:\s*(?:candidate|hash)\b/);
});

test("finance and security pages require the authenticated user and do not use an admin bypass", async () => {
  for (const path of ["../src/app/dashboard/workspace/finance/page.tsx", "../src/app/dashboard/workspace/security/page.tsx"]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /await requireUser\(\)/);
    assert.doesNotMatch(source, /requireSuperAdmin|isSuperAdmin/);
  }
});

test("money parsing and formatting use exact minor units with currency-specific precision", () => {
  assert.equal(parseFinanceAmount("123456789.19", "KES"), 12345678919n);
  assert.equal(formatFinanceAmount(12345678919n, "KES"), "KES 123456789.19");
  assert.equal(formatFinanceAmount(-250n, "KES"), "KES -2.50");
  assert.equal(parseFinanceAmount("1599", "JPY"), 1599n);
  assert.equal(formatFinanceAmount(1599n, "JPY"), "JPY 1599");
  assert.equal(parseFinanceAmount("3.125", "KWD"), 3125n);
  assert.throws(() => parseFinanceAmount("1.001", "KES"), /valid/i);
  assert.throws(() => parseFinanceAmount("-2", "USD"), /valid/i);
});

test("dated finance transaction validation is strict and transfers require two distinct account labels", () => {
  const base = { kind: "EXPENSE", quality: "ACTUAL", amount: "125.50", currency: "KES", occurredOn: "2026-11-17", label: "Rent", category: "Home" };
  assert.equal(parseFinanceTransactionDraft(base).success, true);
  assert.equal(parseFinanceTransactionDraft({ ...base, amount: "0" }).success, false);
  assert.equal(parseFinanceTransactionDraft({ ...base, occurredOn: "2026-02-30" }).success, false);
  assert.equal(parseFinanceTransactionDraft({ ...base, userId: "other" }).success, false);
  assert.equal(parseFinanceTransactionDraft({ ...base, kind: "TRANSFER" }).success, false);
  assert.equal(parseFinanceTransactionDraft({ ...base, kind: "TRANSFER", fromAccount: "cash", toAccount: "cash" }).success, false);
  assert.equal(parseFinanceTransactionDraft({ ...base, kind: "TRANSFER", fromAccount: "cash", toAccount: "bank" }).success, true);
  assert.equal(parseFinanceTransactionDraft({ ...base, kind: "DEBT_REPAYMENT" }).success, false);
});

test("owner-scoped finance drafts reject invalid positions, budget dates, goals and debt assumptions", () => {
  assert.equal(parseFinancePositionDraft({ kind: "ASSET", quality: "ESTIMATE", currency: "USD", value: "25", label: "Car", category: "Vehicle", valuedOn: "2026-11-01" }).success, true);
  assert.equal(parseFinancePositionDraft({ kind: "ASSET", quality: "PLANNED", currency: "USD", value: "25", label: "Car", category: "Vehicle", valuedOn: "2026-11-01" }).success, false);
  assert.equal(parseFinanceBudgetDraft({ name: "Nov", category: "Food", currency: "KES", limitAmount: "10", startsOn: "2026-11-30", endsOn: "2026-11-01" }).success, false);
  assert.equal(parseFinanceGoalDraft({ name: "Reserve", currency: "KES", targetAmount: "0" }).success, false);
  assert.equal(parseFinanceDebtDraft({ name: "Loan", currency: "KES", originalPrincipal: "100", outstandingBalance: "105", interestType: "FIXED", repaymentFrequency: "MONTHLY", annualInterestRate: "150" }).success, false);
  assert.equal(parseFinanceDebtDraft({ name: "Loan", currency: "KES", originalPrincipal: "100", outstandingBalance: "105", interestType: "FIXED", repaymentFrequency: "MONTHLY", annualInterestRate: "12.5" }).success, true);
});

test("recurring schedules and finance reminders require bounded valid schedules and timezones", () => {
  const schedule = { kind: "EXPENSE", amount: "25", currency: "EUR", label: "Rent", category: "Home", frequency: "MONTHLY", interval: 1, nextOn: "2026-12-01" };
  assert.equal(parseFinanceRecurringDraft(schedule).success, true);
  assert.equal(parseFinanceRecurringDraft({ ...schedule, interval: 100 }).success, false);
  assert.equal(parseFinanceRecurringDraft({ ...schedule, kind: "DEBT_REPAYMENT" }).success, false);
  assert.equal(parseFinanceReminderDraft({ kind: "BILL_PAYMENT", title: "Water", remindAt: "2026-12-01T09:00:00+03:00", timezone: "Africa/Nairobi" }).success, true);
  assert.equal(parseFinanceReminderDraft({ kind: "BILL_PAYMENT", title: "Water", remindAt: "2026-12-01T09:00:00+03:00", timezone: "Not/AZone" }).success, false);
  assert.equal(parseFinanceDate("2026-02-30"), null);
});

test("finance updates use allowlisted fields and require a valid valuation revision", () => {
  assert.equal(parseFinanceUpdate("positions", { value: "500.25", currency: "KES", valuedOn: "2026-11-17", expectedRevision: 2 }).success, true);
  assert.equal(parseFinanceUpdate("positions", { value: "500", expectedRevision: -1 }).success, false);
  assert.equal(parseFinanceUpdate("transactions", { notes: "private", workspaceId: "other" }).success, false);
  assert.equal(parseFinanceUpdate("transactions", { amount: "-1", currency: "USD" }).success, false);
  assert.equal(parseFinanceUpdate("transactions", { kind: "SAVINGS_CONTRIBUTION" }).success, false);
});

test("finance summaries keep currencies separate and exclude estimates from actual net worth", () => {
  const result = summarizeFinance([
    { id: "a", kind: "ASSET", confidence: "ACTUAL", currency: "KES", amount: "1000.25", cadence: "ONE_TIME", category: "cash", label: "cash" },
    { id: "b", kind: "LIABILITY", confidence: "ACTUAL", currency: "KES", amount: "250.10", cadence: "ONE_TIME", category: "loan", label: "loan" },
    { id: "c", kind: "ASSET", confidence: "ESTIMATE", currency: "KES", amount: "50000", cadence: "ONE_TIME", category: "property", label: "estimate" },
    { id: "d", kind: "ASSET", confidence: "ACTUAL", currency: "USD", amount: "10", cadence: "ONE_TIME", category: "cash", label: "usd" },
  ]);
  assert.equal(result.length, 2);
  assert.equal(result.find((item) => item.currency === "KES")?.actualAssets, 100025n);
  assert.equal(result.find((item) => item.currency === "KES")?.actualLiabilities, 25010n);
  assert.equal(result.find((item) => item.currency === "KES")?.estimatedAssets, 5000000n);
  assert.equal(result.find((item) => item.currency === "USD")?.actualAssets, 1000n);
});

test("monthly cash-flow normalizes annual recurring entries exactly and separates actual from planned", () => {
  const result = summarizeFinance([
    { id: "a", kind: "INCOME", confidence: "ACTUAL", currency: "KES", amount: "1200", cadence: "ANNUAL", category: "salary", label: "annual" },
    { id: "b", kind: "EXPENSE", confidence: "ACTUAL", currency: "KES", amount: "25.50", cadence: "MONTHLY", category: "home", label: "rent" },
    { id: "c", kind: "EXPENSE", confidence: "PLANNED", currency: "KES", amount: "10", cadence: "MONTHLY", category: "home", label: "plan" },
  ])[0];
  assert.equal(result.actualMonthlyIncome, 10000n);
  assert.equal(result.actualMonthlyExpenses, 2550n);
  assert.equal(result.plannedMonthlyExpenses, 1000n);
});

test("goals cap progress and reject zero targets", () => {
  assert.equal(financeGoalProgress({ id: "g", label: "Goal", currency: "USD", current: "150", target: "100" }), 100);
  assert.throws(() => financeGoalProgress({ id: "g", label: "Goal", currency: "USD", current: "0", target: "0" }), /greater than zero/i);
});

test("budget usage uses only actual same-category same-currency expenses", () => {
  const entries = [
    { id: "a", kind: "EXPENSE", confidence: "ACTUAL", currency: "KES", amount: "60", cadence: "ONE_TIME", category: "food", label: "meal" },
    { id: "b", kind: "EXPENSE", confidence: "PLANNED", currency: "KES", amount: "50", cadence: "ONE_TIME", category: "food", label: "plan" },
    { id: "c", kind: "EXPENSE", confidence: "ACTUAL", currency: "USD", amount: "80", cadence: "ONE_TIME", category: "food", label: "other currency" },
  ];
  assert.deepEqual(financeBudgetUsage({ id: "b", category: "food", currency: "KES", limit: "100" }, entries), { spent: 6000n, remaining: 4000n, percent: 60 });
});
