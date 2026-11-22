import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { Prisma } from "@prisma/client";

const data = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
function makeDb() {
  const state = { transactions: [], positions: [], valuations: [], budgets: [], goals: [], goalMovements: [], debts: [], debtPayments: [], schedules: [], reminders: [], events: [], query: null, failAudit: false, workspaceLookups: [] };
  const workspace = (ownerId) => ({ id: `workspace-${ownerId}`, timezone: "Africa/Nairobi" });
  const tx = {
    personalWorkspace: {
      upsert: async ({ where }) => workspace(where.userId),
      findUnique: async ({ where }) => { state.workspaceLookups.push(where.userId); return where.userId ? workspace(where.userId) : null; },
    },
    workspaceFinanceEvent: { create: async ({ data }) => { if (state.failAudit) throw new Error("audit unavailable"); const row = { id: `event-${state.events.length + 1}`, ...data, createdAt: new Date() }; state.events.push(row); return row; }, findMany: async () => [...state.events].sort((a, b) => b.createdAt - a.createdAt).slice(0, 100) },
    workspaceFinanceTransaction: {
      create: async ({ data }) => { const row = { id: `transaction-${state.transactions.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data, attachments: [] }; if (row.recurringScheduleId && state.transactions.some((x) => x.workspaceId === row.workspaceId && x.recurringScheduleId === row.recurringScheduleId && String(x.recurrenceOn) === String(row.recurrenceOn))) throw new Error("unique occurrence"); state.transactions.push(row); return row; },
      count: async ({ where }) => state.transactions.filter((row) => row.workspaceId === where.workspaceId && !row.deletedAt && row.occurredOn >= where.occurredOn.gte && row.occurredOn <= where.occurredOn.lte).length,
      findMany: async (args) => { state.query = args; return state.transactions.filter((row) => row.workspaceId === args.where.workspaceId && !row.deletedAt).slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? 100)); },
      groupBy: async ({ where }) => { const grouped = new Map(); for (const row of state.transactions.filter((item) => item.workspaceId === where.workspaceId && !item.deletedAt && item.occurredOn >= where.occurredOn.gte && item.occurredOn <= where.occurredOn.lte)) { const key = `${row.currency}:${row.kind}:${row.quality}`; const prev = grouped.get(key) ?? { currency: row.currency, kind: row.kind, quality: row.quality, amount: new Prisma.Decimal(0), count: 0 }; prev.amount = prev.amount.plus(row.amount); prev.count++; grouped.set(key, prev); } return [...grouped.values()].map((row) => ({ currency: row.currency, kind: row.kind, quality: row.quality, _sum: { amount: row.amount }, _count: { _all: row.count } })); },
      findFirst: async ({ where }) => { const row = state.transactions.find((item) => item.id === where.id && item.workspaceId === where.workspaceId); return row ? copy(row) : null; },
      updateMany: async ({ where, data }) => { const row = state.transactions.find((item) => item.id === where.id && item.workspaceId === where.workspaceId && (where.deletedAt === undefined || item.deletedAt === where.deletedAt)); if (!row) return { count: 0 }; Object.assign(row, data, { updatedAt: new Date() }); return { count: 1 }; },
    },
    workspaceFinancePosition: {
      create: async ({ data }) => { const row = { id: `position-${state.positions.length + 1}`, revision: 0, createdAt: new Date(), updatedAt: new Date(), ...data }; state.positions.push(row); return row; },
      findMany: async () => state.positions.filter((row) => !row.archivedAt).map((row) => ({ ...row, valuations: state.valuations.filter((x) => x.positionId === row.id) })),
      findFirst: async ({ where }) => { const row = state.positions.find((item) => item.id === where.id && item.workspaceId === where.workspaceId); return row ? copy(row) : null; },
      updateMany: async ({ where, data }) => { const row = state.positions.find((item) => item.id === where.id && item.workspaceId === where.workspaceId && (where.revision === undefined || item.revision === where.revision)); if (!row) return { count: 0 }; const changes = { ...data }; const revision = changes.revision?.increment ?? 0; delete changes.revision; Object.assign(row, changes, { revision: row.revision + revision, updatedAt: new Date() }); return { count: 1 }; },
    },
    workspaceFinanceValuation: { create: async ({ data }) => { const row = { id: `valuation-${state.valuations.length + 1}`, createdAt: new Date(), ...data }; state.valuations.push(row); return row; } },
    workspaceFinanceBudget: { create: async ({ data }) => { const row = { id: `budget-${state.budgets.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data }; state.budgets.push(row); return row; }, findMany: async () => state.budgets.filter((row) => !row.archivedAt), findFirst: async ({ where }) => state.budgets.find((row) => row.id === where.id && row.workspaceId === where.workspaceId) ?? null, updateMany: async ({ where, data }) => update(state.budgets, where, data) },
    workspaceFinanceGoal: { create: async ({ data }) => { const row = { id: `goal-${state.goals.length + 1}`, currentAmount: new Prisma.Decimal(0), createdAt: new Date(), updatedAt: new Date(), ...data }; state.goals.push(row); return row; }, findMany: async () => state.goals.filter((row) => row.status !== "ARCHIVED"), findFirst: async ({ where }) => { const row = state.goals.find((item) => item.id === where.id && item.workspaceId === where.workspaceId && item.status !== "ARCHIVED"); return row ? copy(row) : null; }, updateMany: async ({ where, data }) => { const row = state.goals.find((item) => item.id === where.id && item.workspaceId === where.workspaceId && (!where.currentAmount || item.currentAmount.greaterThanOrEqualTo(where.currentAmount.gte))); if (!row) return { count: 0 }; const amount = data.currentAmount.increment ?? data.currentAmount.decrement; row.currentAmount = data.currentAmount.increment ? row.currentAmount.plus(amount) : row.currentAmount.minus(amount); return { count: 1 }; } },
    workspaceFinanceGoalMovement: { create: async ({ data }) => { const row = { id: `movement-${state.goalMovements.length + 1}`, createdAt: new Date(), ...data }; state.goalMovements.push(row); return row; } },
    workspaceFinanceDebt: { create: async ({ data }) => { const row = { id: `debt-${state.debts.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data }; state.debts.push(row); return row; }, findMany: async () => state.debts.filter((row) => !row.archivedAt), findFirst: async ({ where }) => { const row = state.debts.find((item) => item.id === where.id && item.workspaceId === where.workspaceId && !item.archivedAt); return row ? copy(row) : null; }, updateMany: async ({ where, data }) => { const row = state.debts.find((item) => item.id === where.id && item.workspaceId === where.workspaceId && item.outstandingBalance.greaterThanOrEqualTo(where.outstandingBalance.gte)); if (!row) return { count: 0 }; row.outstandingBalance = row.outstandingBalance.minus(data.outstandingBalance.decrement); return { count: 1 }; } },
    workspaceFinanceDebtPayment: { create: async ({ data }) => { const row = { id: `payment-${state.debtPayments.length + 1}`, createdAt: new Date(), ...data }; state.debtPayments.push(row); return row; } },
    workspaceFinanceRecurringSchedule: { create: async ({ data }) => { const row = { id: `schedule-${state.schedules.length + 1}`, active: true, createdAt: new Date(), updatedAt: new Date(), ...data }; state.schedules.push(row); return row; }, findMany: async () => state.schedules, findFirst: async ({ where }) => { const row = state.schedules.find((item) => item.id === where.id && item.workspaceId === where.workspaceId && (where.active === undefined || item.active === where.active)); return row ? copy(row) : null; }, updateMany: async ({ where, data }) => { const row = state.schedules.find((item) => item.id === where.id && item.workspaceId === where.workspaceId && (where.active === undefined || item.active === where.active) && (where.nextOn === undefined || item.nextOn.getTime() === where.nextOn.getTime())); if (!row) return { count: 0 }; Object.assign(row, data); return { count: 1 }; } },
    workspaceFinanceReminder: { create: async ({ data }) => { const row = { id: `reminder-${state.reminders.length + 1}`, status: "ACTIVE", createdAt: new Date(), updatedAt: new Date(), ...data }; state.reminders.push(row); return row; }, findMany: async () => state.reminders.filter((row) => row.status === "ACTIVE"), findFirst: async ({ where }) => state.reminders.find((row) => row.id === where.id && row.workspaceId === where.workspaceId) ?? null, updateMany: async ({ where, data }) => update(state.reminders, where, data) },
  };
  function update(rows, where, data) { const row = rows.find((item) => item.id === where.id && item.workspaceId === where.workspaceId); if (!row) return { count: 0 }; Object.assign(row, data); return { count: 1 }; }
  function copy(value) { if (value instanceof Date) return new Date(value); if (value instanceof Prisma.Decimal) return new Prisma.Decimal(value.toString()); if (Array.isArray(value)) return value.map(copy); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)])); return value; }
  const prisma = { ...tx, $transaction: async (callback) => { const before = copy(state); try { return await callback(tx); } catch (error) { for (const key of Object.keys(state)) delete state[key]; Object.assign(state, before); throw error; } } };
  return { state, prisma };
}
const db = makeDb();
globalThis.__financeDb = db;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: data("export {};"), shortCircuit: true };
  if (specifier === "@/lib/prisma") return { url: data("export const prisma=globalThis.__financeDb.prisma;"), shortCircuit: true };
  if (specifier === "@/lib/personal-workspace-finance-core") return { url: new URL("../src/lib/personal-workspace-finance-core.ts", import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const service = await import("../src/lib/personal-workspace-finance.ts");
const store = () => db;
test.beforeEach(() => { const fresh = makeDb().state; for (const key of Object.keys(db.state)) delete db.state[key]; Object.assign(db.state, fresh); });

test("finance records derive workspace ownership from the trusted owner argument and audit fields without values", async () => {
  const result = await service.createFinanceResource("alice", "transactions", { workspaceId: "workspace-victim", kind: "EXPENSE", quality: "ACTUAL", amount: "12.50", currency: "KES", occurredOn: "2026-11-17", label: "Food", category: "Home" });
  assert.equal(result.workspaceId, "workspace-alice");
  assert.equal(store().state.events[0].targetId, result.id);
  assert.deepEqual(store().state.events[0].changedFields, ["kind", "quality", "amount", "currency", "occurredOn", "label", "category"]);
  assert.equal(JSON.stringify(store().state.events[0]).includes("12.50"), false);
});

test("transaction and audit writes roll back together when the audit sink rejects", async () => {
  store().state.failAudit = true;
  await assert.rejects(service.createFinanceResource("alice", "transactions", { kind: "EXPENSE", quality: "ACTUAL", amount: "12.50", currency: "KES", occurredOn: "2026-11-17", label: "Food", category: "Home" }));
  assert.equal(store().state.transactions.length, 0);
  assert.equal(store().state.events.length, 0);
});

test("finance update ownership is workspace-scoped and position valuations use optimistic revisions", async () => {
  const position = await service.createFinanceResource("alice", "positions", { kind: "ASSET", label: "Savings", category: "Cash", currency: "USD", value: "100", quality: "ACTUAL", valuedOn: "2026-11-01" });
  const foreign = await service.updateFinanceResource("bob", "positions", position.id, { value: "1", valuedOn: "2026-11-02", expectedRevision: 0 });
  assert.equal(foreign, null);
  const updated = await service.updateFinanceResource("alice", "positions", position.id, { value: "125.50", valuedOn: "2026-11-17", expectedRevision: 0 });
  assert.equal(updated.value.toString(), "125.5");
  assert.equal(store().state.positions[0].revision, 1);
  assert.equal(store().state.valuations.length, 2);
  const stale = await service.updateFinanceResource("alice", "positions", position.id, { value: "130", valuedOn: "2026-11-18", expectedRevision: 0 });
  assert.equal(stale.conflict, true);
  assert.equal(store().state.valuations.length, 2, "stale updates must not append a valuation history row");
  const missingRevision = await service.updateFinanceResource("alice", "positions", position.id, { value: "130", valuedOn: "2026-11-18" });
  assert.equal(missingRevision.conflict, true, "all position edits require optimistic concurrency control");
  assert.equal(store().state.valuations.length, 2);
});

test("transaction updates validate the complete record and keep estimates separate from actuals", async () => {
  const transaction = await service.createFinanceResource("alice", "transactions", { kind: "INCOME", quality: "ACTUAL", amount: "500", currency: "KES", occurredOn: "2026-11-17", label: "Salary", category: "Work" });
  const estimated = await service.updateFinanceResource("alice", "transactions", transaction.id, { quality: "ESTIMATE" });
  assert.equal(estimated.quality, "ESTIMATE");
  const estimate = await service.createFinanceResource("alice", "transactions", { kind: "INCOME", quality: "ESTIMATE", amount: "250", currency: "KES", occurredOn: "2026-11-18", label: "Variable pay", category: "Work" });
  assert.equal(estimate.quality, "ESTIMATE");
  await assert.rejects(service.updateFinanceResource("alice", "transactions", transaction.id, { kind: "ASSET", quality: "ACTUAL" }), /invalid|fields/i);
  assert.equal(store().state.transactions[0].kind, "INCOME", "invalid merged record must not persist");
  const report = await service.getPersonalFinance("alice", { from: "2026-11-01", to: "2026-11-30" });
  const kes = report.summary.find((row) => row.currency === "KES");
  assert.equal(kes.actualIncome, "0");
  assert.equal(kes.estimatedIncome, "750.0000");
});

test("goal contributions and withdrawals keep the goal balance, linked ledger and history atomic", async () => {
  const goal = await service.createFinanceResource("alice", "goals", { name: "Reserve", currency: "KES", targetAmount: "1000", targetOn: "2027-12-31" });
  await service.createGoalMovement("alice", goal.id, { kind: "CONTRIBUTION", amount: "100.25", occurredOn: "2026-11-17" });
  assert.equal(store().state.goals[0].currentAmount.toString(), "100.25");
  assert.equal(store().state.transactions[0].kind, "SAVINGS_CONTRIBUTION");
  assert.equal(store().state.goalMovements.length, 1);
  await assert.rejects(service.createGoalMovement("alice", goal.id, { kind: "WITHDRAWAL", amount: "200", occurredOn: "2026-11-18" }));
  assert.equal(store().state.goals[0].currentAmount.toString(), "100.25");
  assert.equal(store().state.transactions.length, 1);
});

test("debt repayment splits are validated and principal balance updates with ledger and history in one transaction", async () => {
  const debt = await service.createFinanceResource("alice", "debts", { name: "Loan", currency: "USD", originalPrincipal: "1000", outstandingBalance: "900", interestType: "FIXED", repaymentFrequency: "MONTHLY", repaymentAmount: "100", annualInterestRate: "12" });
  const payment = await service.createDebtPayment("alice", debt.id, { amount: "110", principalAmount: "100", interestAmount: "10", occurredOn: "2026-11-17" });
  assert.equal(payment.outstandingBalance, "800");
  assert.equal(store().state.transactions[0].kind, "DEBT_REPAYMENT");
  assert.equal(store().state.debtPayments.length, 1);
  await assert.rejects(service.createDebtPayment("alice", debt.id, { amount: "900", principalAmount: "900", interestAmount: "0", occurredOn: "2026-11-18" }));
  assert.equal(store().state.debts[0].outstandingBalance.toString(), "800");
  assert.equal(store().state.transactions.length, 1);
});

test("recurring occurrence advances the schedule and uses a unique schedule/date ledger key", async () => {
  const schedule = await service.createFinanceResource("alice", "recurring", { kind: "EXPENSE", amount: "20", currency: "EUR", label: "Rent", category: "Home", frequency: "MONTHLY", interval: 1, nextOn: "2026-01-31" });
  const first = await service.createNextRecurringOccurrence("alice", schedule.id);
  assert.equal(first.transaction.recurrenceOn.toISOString().slice(0, 10), "2026-01-31");
  assert.equal(first.nextOn.toISOString().slice(0, 10), "2026-02-28");
  assert.equal(store().state.transactions[0].quality, "PLANNED");
});

test("recurring and reminder edits validate merged state and support safe pause/resume", async () => {
  const schedule = await service.createFinanceResource("alice", "recurring", { kind: "EXPENSE", amount: "20", currency: "EUR", label: "Rent", category: "Home", frequency: "MONTHLY", interval: 1, nextOn: "2026-12-01" });
  await service.updateFinanceResource("alice", "recurring", schedule.id, { active: false });
  assert.equal(store().state.schedules[0].active, false);
  await service.updateFinanceResource("alice", "recurring", schedule.id, { active: true });
  assert.equal(store().state.schedules[0].active, true);
  await assert.rejects(service.updateFinanceResource("alice", "recurring", schedule.id, { interval: 100 }), /invalid/i);
  await assert.rejects(service.updateFinanceResource("alice", "recurring", schedule.id, { kind: "TRANSFER" }), /account/i);
  const reminder = await service.createFinanceResource("alice", "reminders", { kind: "BILL_PAYMENT", title: "Water bill", remindAt: "2026-12-02T09:00:00.000Z", timezone: "Africa/Nairobi" });
  await assert.rejects(service.updateFinanceResource("alice", "reminders", reminder.id, { timezone: "Not/AZone" }), /timezone/i);
  assert.equal(store().state.reminders[0].timezone, "Africa/Nairobi");
});
