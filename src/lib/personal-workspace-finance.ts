import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isFinanceCurrency, parseFinanceAmount, parseFinanceDate, parseFinanceRecurringDraft, parseFinanceReminderDraft, parseFinanceTransactionDraft } from "@/lib/personal-workspace-finance-core";

type FinanceResource = "transactions" | "positions" | "budgets" | "goals" | "debts" | "recurring" | "reminders";
type DateRange = { from: string; to: string };
type FinanceTx = Prisma.TransactionClient;
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const dec = (value: string) => new Prisma.Decimal(value);

function event(tx: FinanceTx, workspaceId: string, action: string, targetType: string, targetId: string, changedFields: string[]) {
  return tx.workspaceFinanceEvent.create({ data: { workspaceId, action, targetType, targetId, changedFields } });
}

async function getWorkspace(ownerUserId: string, create = false) {
  if (create) return prisma.personalWorkspace.upsert({ where: { userId: ownerUserId }, create: { userId: ownerUserId }, update: {}, select: { id: true, timezone: true } });
  return prisma.personalWorkspace.findUnique({ where: { userId: ownerUserId }, select: { id: true, timezone: true } });
}

function nextDate(current: Date, frequency: "WEEKLY" | "MONTHLY" | "ANNUAL", interval: number) {
  const year = current.getUTCFullYear(); const month = current.getUTCMonth(); const day = current.getUTCDate();
  if (frequency === "WEEKLY") return new Date(Date.UTC(year, month, day + 7 * interval));
  const months = frequency === "ANNUAL" ? 12 * interval : interval;
  const targetMonth = month + months; const targetYear = year + Math.floor(targetMonth / 12); const normalizedMonth = targetMonth % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay)));
}

export async function getPersonalFinance(ownerUserId: string, range: DateRange, options: { page?: number; pageSize?: number; kind?: string; currency?: string; q?: string } = {}) {
  if (!ownerUserId || !parseFinanceDate(range.from) || !parseFinanceDate(range.to) || range.from > range.to || (options.kind && !["INCOME", "EXPENSE", "TRANSFER", "SAVINGS_CONTRIBUTION", "SAVINGS_WITHDRAWAL", "DEBT_REPAYMENT", "ASSET_ACQUISITION", "ASSET_DISPOSAL"].includes(options.kind)) || (options.currency && !isFinanceCurrency(options.currency))) throw new Error("Invalid finance query.");
  const workspace = await getWorkspace(ownerUserId);
  if (!workspace) return { workspace: null, summary: [], transactions: { items: [], total: 0, page: 1, pageSize: 25 }, positions: [], budgets: [], goals: [], debts: [], recurring: [], reminders: [], history: [] };
  const from = date(range.from); const through = date(range.to);
  const requestedPage = Math.max(1, Math.min(100_000, options.page ?? 1)); const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 25));
  const search = options.q?.trim().slice(0, 100);
  const transactionWhere: Prisma.WorkspaceFinanceTransactionWhereInput = {
    workspaceId: workspace.id, deletedAt: null, occurredOn: { gte: from, lte: through },
    ...(options.kind ? { kind: options.kind as never } : {}),
    ...(options.currency ? { currency: options.currency } : {}),
    ...(search ? { OR: [{ label: { contains: search, mode: "insensitive" } }, { category: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }] } : {}),
  };
  const [transactionCount, positions, budgets, goals, debts, recurring, reminders, history] = await Promise.all([
    prisma.workspaceFinanceTransaction.count({ where: transactionWhere }),
    prisma.workspaceFinancePosition.findMany({ where: { workspaceId: workspace.id, archivedAt: null }, orderBy: [{ valuedOn: "desc" }, { id: "asc" }], take: 500, include: { valuations: { orderBy: [{ valuedOn: "desc" }, { createdAt: "desc" }], take: 50 } } }),
    prisma.workspaceFinanceBudget.findMany({ where: { workspaceId: workspace.id, archivedAt: null, startsOn: { lte: through }, endsOn: { gte: from } }, orderBy: [{ startsOn: "desc" }, { id: "asc" }], take: 250 }),
    prisma.workspaceFinanceGoal.findMany({ where: { workspaceId: workspace.id, status: { not: "ARCHIVED" } }, orderBy: [{ targetOn: "asc" }, { updatedAt: "desc" }, { id: "asc" }], take: 250, include: { movements: { orderBy: [{ occurredOn: "desc" }, { id: "asc" }], take: 100, include: { transaction: { select: { label: true, amount: true, currency: true } } } } } }),
    prisma.workspaceFinanceDebt.findMany({ where: { workspaceId: workspace.id, archivedAt: null }, orderBy: [{ nextDueOn: "asc" }, { updatedAt: "desc" }, { id: "asc" }], take: 250, include: { payments: { orderBy: [{ occurredOn: "desc" }, { id: "asc" }], take: 100, include: { transaction: { select: { label: true, amount: true, currency: true } } } } } }),
    prisma.workspaceFinanceRecurringSchedule.findMany({ where: { workspaceId: workspace.id }, orderBy: [{ active: "desc" }, { nextOn: "asc" }, { id: "asc" }], take: 250 }),
    prisma.workspaceFinanceReminder.findMany({ where: { workspaceId: workspace.id, status: "ACTIVE", remindAt: { gte: new Date(Date.now() - 366 * 86_400_000), lte: new Date(Date.now() + 366 * 86_400_000) } }, orderBy: [{ remindAt: "asc" }, { id: "asc" }], take: 250 }),
    prisma.workspaceFinanceEvent.findMany({ where: { workspaceId: workspace.id }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 100, select: { id: true, action: true, targetType: true, targetId: true, changedFields: true, createdAt: true } }),
  ]);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(transactionCount / pageSize)));
  const transactions = await prisma.workspaceFinanceTransaction.findMany({ where: transactionWhere, orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize, include: { attachments: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { mediaAsset: { select: { id: true, mimeType: true, byteSize: true } } } } } });
  const txSummary = await prisma.workspaceFinanceTransaction.groupBy({ by: ["currency", "kind", "quality"], where: { workspaceId: workspace.id, deletedAt: null, occurredOn: { gte: from, lte: through } }, _sum: { amount: true }, _count: { _all: true } });
  const map = new Map<string, Record<string, string | number>>();
  const bucket = (currency: string) => {
    let item = map.get(currency);
    if (!item) { item = { currency, actualIncome: "0", estimatedIncome: "0", plannedIncome: "0", actualExpenses: "0", estimatedExpenses: "0", plannedExpenses: "0", debtRepayments: "0", savingsContributions: "0", savingsWithdrawals: "0", transfers: "0", actualAssets: "0", estimatedAssets: "0", actualLiabilities: "0", estimatedLiabilities: "0", recordedTransactions: 0 }; map.set(currency, item); }
    return item;
  };
  for (const row of txSummary) {
    const item = bucket(row.currency); const amount = new Prisma.Decimal(row._sum.amount ?? 0).toFixed(4); item.recordedTransactions = Number(item.recordedTransactions) + row._count._all;
    if (row.kind === "INCOME") { const key = row.quality === "PLANNED" ? "plannedIncome" : row.quality === "ESTIMATE" ? "estimatedIncome" : "actualIncome"; item[key] = new Prisma.Decimal(String(item[key])).plus(amount).toFixed(4); }
    if (row.kind === "EXPENSE") { const key = row.quality === "PLANNED" ? "plannedExpenses" : row.quality === "ESTIMATE" ? "estimatedExpenses" : "actualExpenses"; item[key] = new Prisma.Decimal(String(item[key])).plus(amount).toFixed(4); }
    if (row.kind === "DEBT_REPAYMENT") item.debtRepayments = new Prisma.Decimal(String(item.debtRepayments)).plus(amount).toFixed(4);
    if (row.kind === "SAVINGS_CONTRIBUTION") item.savingsContributions = new Prisma.Decimal(String(item.savingsContributions)).plus(amount).toFixed(4);
    if (row.kind === "SAVINGS_WITHDRAWAL") item.savingsWithdrawals = new Prisma.Decimal(String(item.savingsWithdrawals)).plus(amount).toFixed(4);
    if (row.kind === "TRANSFER") item.transfers = new Prisma.Decimal(String(item.transfers)).plus(amount).toFixed(4);
  }
  for (const row of positions) { const item = bucket(row.currency); const key = row.kind === "ASSET" ? row.quality === "ESTIMATE" ? "estimatedAssets" : "actualAssets" : row.quality === "ESTIMATE" ? "estimatedLiabilities" : "actualLiabilities"; item[key] = new Prisma.Decimal(String(item[key])).plus(row.value.toString()).toFixed(4); }
  for (const debt of debts) { const item = bucket(debt.currency); item.actualLiabilities = new Prisma.Decimal(String(item.actualLiabilities)).plus(debt.outstandingBalance.toString()).toFixed(4); }
  const budgetActuals = budgets.length ? await prisma.workspaceFinanceTransaction.findMany({ where: { workspaceId: workspace.id, deletedAt: null, kind: "EXPENSE", quality: "ACTUAL", occurredOn: { gte: budgets.reduce((min, item) => item.startsOn < min ? item.startsOn : min, budgets[0].startsOn), lte: budgets.reduce((max, item) => item.endsOn > max ? item.endsOn : max, budgets[0].endsOn) } }, orderBy: [{ occurredOn: "asc" }, { id: "asc" }], take: 25_001, select: { currency: true, category: true, amount: true, occurredOn: true } }) : [];
  const budgetRows = budgets.map((budget) => {
    const spent = budgetActuals.filter((row) => row.currency === budget.currency && row.category.toLocaleLowerCase() === budget.category.toLocaleLowerCase() && row.occurredOn >= budget.startsOn && row.occurredOn <= budget.endsOn).reduce((sum, row) => sum.plus(row.amount.toString()), new Prisma.Decimal(0));
    return { ...budget, spent: spent.toFixed(4), remaining: budget.limitAmount.minus(spent).toFixed(4), percent: budget.limitAmount.isZero() ? 0 : spent.div(budget.limitAmount).mul(100).toDecimalPlaces(2).toNumber(), ...(budgetActuals.length > 25_000 ? { calculationTruncated: true } : {}) };
  });
  const goalRows = goals.map((goal) => ({ ...goal, progressPercent: goal.targetAmount.isZero() ? 0 : goal.currentAmount.div(goal.targetAmount).mul(100).toDecimalPlaces(2).toNumber() }));
  return { workspace: { timezone: workspace.timezone }, summary: [...map.values()], transactions: { items: transactions, total: transactionCount, page, pageSize }, positions, budgets: budgetRows, goals: goalRows, debts, recurring, reminders, history };
}

async function withWorkspace<T>(ownerUserId: string, fn: (tx: FinanceTx, workspaceId: string) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.personalWorkspace.upsert({ where: { userId: ownerUserId }, create: { userId: ownerUserId }, update: {}, select: { id: true } });
    return fn(tx, workspace.id);
  });
}

export async function createFinanceResource(ownerUserId: string, resource: FinanceResource, input: Record<string, unknown>) {
  return withWorkspace(ownerUserId, async (tx, workspaceId) => {
    if (resource === "transactions") {
      const kind = input.kind as string;
      if (["DEBT_REPAYMENT", "SAVINGS_CONTRIBUTION", "SAVINGS_WITHDRAWAL"].includes(kind)) throw new Error("Use the linked debt or savings action for this transaction type.");
      const created = await tx.workspaceFinanceTransaction.create({ data: { workspaceId, kind: input.kind as never, quality: input.quality as never, amount: dec(String(input.amount)), currency: String(input.currency), occurredOn: date(String(input.occurredOn)), label: String(input.label).trim(), category: String(input.category).trim(), subcategory: input.subcategory ? String(input.subcategory).trim() : null, paymentMethod: input.paymentMethod ? String(input.paymentMethod).trim() : null, description: input.description ? String(input.description).trim() : null, notes: input.notes ? String(input.notes).trim() : null, fromAccount: input.fromAccount ? String(input.fromAccount).trim() : null, toAccount: input.toAccount ? String(input.toAccount).trim() : null } });
      await event(tx, workspaceId, "TRANSACTION_CREATED", "TRANSACTION", created.id, ["kind", "quality", "amount", "currency", "occurredOn", "label", "category"]);
      return created;
    }
    if (resource === "positions") {
      const created = await tx.workspaceFinancePosition.create({ data: { workspaceId, kind: input.kind as never, label: String(input.label).trim(), category: String(input.category).trim(), currency: String(input.currency), value: dec(String(input.value)), quality: input.quality as never, valuedOn: date(String(input.valuedOn)), notes: input.notes ? String(input.notes).trim() : null } });
      await tx.workspaceFinanceValuation.create({ data: { workspaceId, positionId: created.id, value: created.value, quality: created.quality, valuedOn: created.valuedOn } });
      await event(tx, workspaceId, "POSITION_CREATED", "POSITION", created.id, ["kind", "label", "category", "currency", "value", "quality", "valuedOn"]);
      return created;
    }
    if (resource === "budgets") {
      const created = await tx.workspaceFinanceBudget.create({ data: { workspaceId, name: String(input.name).trim(), category: String(input.category).trim(), currency: String(input.currency), limitAmount: dec(String(input.limitAmount)), startsOn: date(String(input.startsOn)), endsOn: date(String(input.endsOn)) } });
      await event(tx, workspaceId, "BUDGET_CREATED", "BUDGET", created.id, ["name", "category", "currency", "limitAmount", "startsOn", "endsOn"]); return created;
    }
    if (resource === "goals") {
      const created = await tx.workspaceFinanceGoal.create({ data: { workspaceId, name: String(input.name).trim(), description: input.description ? String(input.description).trim() : null, currency: String(input.currency), targetAmount: dec(String(input.targetAmount)), targetOn: input.targetOn ? date(String(input.targetOn)) : null } });
      await event(tx, workspaceId, "GOAL_CREATED", "GOAL", created.id, ["name", "currency", "targetAmount", "targetOn"]); return created;
    }
    if (resource === "debts") {
      const created = await tx.workspaceFinanceDebt.create({ data: { workspaceId, name: String(input.name).trim(), lenderDescription: input.lenderDescription ? String(input.lenderDescription).trim() : null, currency: String(input.currency), originalPrincipal: dec(String(input.originalPrincipal)), outstandingBalance: dec(String(input.outstandingBalance)), annualInterestRate: input.annualInterestRate ? dec(String(input.annualInterestRate)) : null, interestType: input.interestType as never, repaymentFrequency: input.repaymentFrequency as never, repaymentAmount: input.repaymentAmount ? dec(String(input.repaymentAmount)) : null, nextDueOn: input.nextDueOn ? date(String(input.nextDueOn)) : null, notes: input.notes ? String(input.notes).trim() : null } });
      await event(tx, workspaceId, "DEBT_CREATED", "DEBT", created.id, ["name", "currency", "originalPrincipal", "outstandingBalance", "annualInterestRate", "repaymentFrequency"]); return created;
    }
    if (resource === "recurring") {
      const created = await tx.workspaceFinanceRecurringSchedule.create({ data: { workspaceId, kind: input.kind as never, quality: "PLANNED", amount: dec(String(input.amount)), currency: String(input.currency), label: String(input.label).trim(), category: String(input.category).trim(), frequency: input.frequency as never, interval: Number(input.interval), nextOn: date(String(input.nextOn)), fromAccount: input.fromAccount ? String(input.fromAccount).trim() : null, toAccount: input.toAccount ? String(input.toAccount).trim() : null } });
      await event(tx, workspaceId, "RECURRING_CREATED", "RECURRING", created.id, ["kind", "amount", "currency", "frequency", "interval", "nextOn"]); return created;
    }
    const created = await tx.workspaceFinanceReminder.create({ data: { workspaceId, taskId: input.taskId ? String(input.taskId) : null, kind: input.kind as never, title: String(input.title).trim(), remindAt: new Date(String(input.remindAt)), timezone: String(input.timezone) } });
    await event(tx, workspaceId, "REMINDER_CREATED", "REMINDER", created.id, ["kind", "title", "remindAt", "timezone", "taskId"]); return created;
  });
}

const models = {
  transactions: "workspaceFinanceTransaction", positions: "workspaceFinancePosition", budgets: "workspaceFinanceBudget",
  goals: "workspaceFinanceGoal", debts: "workspaceFinanceDebt", recurring: "workspaceFinanceRecurringSchedule", reminders: "workspaceFinanceReminder",
} as const;

export async function updateFinanceResource(ownerUserId: string, resource: FinanceResource, id: string, input: Record<string, unknown>, remove = false) {
  return withWorkspace(ownerUserId, async (tx, workspaceId) => {
    const model = tx[models[resource]] as unknown as { findFirst: (args: unknown) => Promise<Record<string, unknown> | null>; updateMany: (args: unknown) => Promise<{ count: number }> };
    const current = await model.findFirst({ where: { id, workspaceId } });
    if (!current) return null;
    if (remove) {
      if (resource === "transactions") {
        const linked = await tx.workspaceFinanceTransaction.findFirst({ where: { id, workspaceId }, select: { goalMovement: { select: { id: true } }, debtPayment: { select: { id: true } } } });
        if (linked?.goalMovement || linked?.debtPayment) throw new Error("Linked finance ledger entries cannot be archived independently.");
      }
      const data = resource === "transactions" ? { deletedAt: new Date() } : resource === "positions" || resource === "budgets" || resource === "debts" ? { archivedAt: new Date() } : resource === "goals" ? { status: "ARCHIVED" } : resource === "recurring" ? { active: false } : { status: "DISMISSED" };
      await model.updateMany({ where: { id, workspaceId }, data });
      await event(tx, workspaceId, `${resource.toUpperCase()}_ARCHIVED`, resource.slice(0, -1).toUpperCase(), id, ["archivedAt"]);
      return { archived: true };
    }
    let data: Record<string, unknown> = {};
    const changed = Object.keys(input).filter((key) => key !== "expectedRevision");
    if (resource === "positions" && !Number.isInteger(input.expectedRevision)) return { conflict: true, revision: current.revision };
    if (resource === "transactions") {
      // Validate the complete post-update record, not merely the patch. This
      // keeps kind/quality combinations safe even when only one is changed.
      const currentDate = current.occurredOn instanceof Date ? current.occurredOn.toISOString().slice(0, 10) : String(current.occurredOn).slice(0, 10);
      const parsedTransaction = parseFinanceTransactionDraft({
        kind: current.kind, quality: current.quality, amount: String(current.amount), currency: current.currency,
        occurredOn: currentDate, label: current.label, category: current.category,
        subcategory: current.subcategory, paymentMethod: current.paymentMethod, description: current.description,
        notes: current.notes, fromAccount: current.fromAccount, toAccount: current.toAccount, ...input,
      });
      if (!parsedTransaction.success) throw new Error(parsedTransaction.message);
      const linked = await tx.workspaceFinanceTransaction.findFirst({ where: { id, workspaceId }, select: { goalMovement: { select: { id: true } }, debtPayment: { select: { id: true } } } });
      if (linked?.goalMovement || linked?.debtPayment) throw new Error("Linked finance ledger entries are managed by their source records.");
      const transactionInput = Object.fromEntries(Object.entries(input).filter(([key]) => key !== "expectedRevision"));
      data = { ...transactionInput, ...(input.amount !== undefined ? { amount: dec(String(input.amount)) } : {}), ...(input.occurredOn ? { occurredOn: date(String(input.occurredOn)) } : {}) };
    } else if (resource === "positions") {
      const positionInput = Object.fromEntries(Object.entries(input).filter(([key]) => key !== "expectedRevision"));
      if (input.currency !== undefined && input.currency !== current.currency) throw new Error("Currency cannot change after valuation history exists.");
      data = { ...positionInput, ...(input.value !== undefined ? { value: dec(String(input.value)) } : {}), ...(input.valuedOn ? { valuedOn: date(String(input.valuedOn)) } : {}), revision: { increment: 1 } };
    } else if (resource === "budgets") {
      data = { ...input, ...(input.limitAmount !== undefined ? { limitAmount: dec(String(input.limitAmount)) } : {}), ...(input.startsOn ? { startsOn: date(String(input.startsOn)) } : {}), ...(input.endsOn ? { endsOn: date(String(input.endsOn)) } : {}) };
    } else if (resource === "goals") {
      data = { ...input, ...(input.targetAmount !== undefined ? { targetAmount: dec(String(input.targetAmount)) } : {}), ...(input.targetOn !== undefined ? { targetOn: input.targetOn ? date(String(input.targetOn)) : null } : {}) };
    } else if (resource === "debts") {
      data = { ...input, ...(input.originalPrincipal ? { originalPrincipal: dec(String(input.originalPrincipal)) } : {}), ...(input.outstandingBalance ? { outstandingBalance: dec(String(input.outstandingBalance)) } : {}), ...(input.annualInterestRate ? { annualInterestRate: dec(String(input.annualInterestRate)) } : {}), ...(input.repaymentAmount ? { repaymentAmount: dec(String(input.repaymentAmount)) } : {}), ...(input.nextDueOn !== undefined ? { nextDueOn: input.nextDueOn ? date(String(input.nextDueOn)) : null } : {}) };
    } else if (resource === "recurring") data = { ...input, ...(input.amount !== undefined ? { amount: dec(String(input.amount)) } : {}), ...(input.nextOn ? { nextOn: date(String(input.nextOn)) } : {}) };
    else data = { ...input, ...(input.remindAt ? { remindAt: new Date(String(input.remindAt)) } : {}) };
    if (resource === "recurring") {
      const parsedSchedule = parseFinanceRecurringDraft({ kind: current.kind, amount: String(current.amount), currency: current.currency, label: current.label, category: current.category, frequency: current.frequency, interval: current.interval, nextOn: current.nextOn instanceof Date ? current.nextOn.toISOString().slice(0, 10) : String(current.nextOn).slice(0, 10), fromAccount: current.fromAccount, toAccount: current.toAccount, ...Object.fromEntries(Object.entries(input).filter(([key]) => key !== "active")) });
      if (!parsedSchedule.success) throw new Error(parsedSchedule.message);
    }
    if (resource === "reminders") {
      const parsedReminder = parseFinanceReminderDraft({ kind: current.kind, title: current.title, remindAt: current.remindAt instanceof Date ? current.remindAt.toISOString() : current.remindAt, timezone: current.timezone, taskId: current.taskId, ...input });
      if (!parsedReminder.success) throw new Error(parsedReminder.message);
    }
    if (resource === "positions" && Number.isInteger(input.expectedRevision) && current.revision !== input.expectedRevision) return { conflict: true, revision: current.revision };
    const result = await model.updateMany({ where: { id, workspaceId, ...(resource === "positions" && Number.isInteger(input.expectedRevision) ? { revision: input.expectedRevision } : {}) }, data });
    if (result.count !== 1) return { conflict: true };
    if (resource === "positions" && (input.value !== undefined || input.quality !== undefined || input.valuedOn !== undefined)) {
      await tx.workspaceFinanceValuation.create({ data: { workspaceId, positionId: id, value: input.value !== undefined ? dec(String(input.value)) : current.value as Prisma.Decimal, quality: input.quality !== undefined ? input.quality as "ACTUAL" | "ESTIMATE" : current.quality as "ACTUAL" | "ESTIMATE", valuedOn: input.valuedOn ? date(String(input.valuedOn)) : current.valuedOn as Date } });
    }
    await event(tx, workspaceId, `${resource.toUpperCase()}_UPDATED`, resource.slice(0, -1).toUpperCase(), id, changed);
    return model.findFirst({ where: { id, workspaceId } });
  });
}

export async function createGoalMovement(ownerUserId: string, goalId: string, input: { kind: "CONTRIBUTION" | "WITHDRAWAL"; amount: string; occurredOn: string; label?: string }) {
  return withWorkspace(ownerUserId, async (tx, workspaceId) => {
    const goal = await tx.workspaceFinanceGoal.findFirst({ where: { id: goalId, workspaceId, status: { not: "ARCHIVED" } } });
    if (!goal) return null;
    const amount = dec(input.amount);
    if (!isFinanceCurrency(goal.currency) || parseFinanceAmount(input.amount, goal.currency) <= BigInt(0) || !parseFinanceDate(input.occurredOn) || (input.label?.length ?? 0) > 120) throw new Error("Contribution fields are invalid.");
    const next = input.kind === "CONTRIBUTION" ? { increment: amount } : { decrement: amount };
    const where = input.kind === "WITHDRAWAL" ? { id: goalId, workspaceId, currentAmount: { gte: amount } } : { id: goalId, workspaceId };
    const changed = await tx.workspaceFinanceGoal.updateMany({ where, data: { currentAmount: next } });
    if (changed.count !== 1) throw new Error("Savings balance is insufficient or changed concurrently.");
    const txKind = input.kind === "CONTRIBUTION" ? "SAVINGS_CONTRIBUTION" : "SAVINGS_WITHDRAWAL";
    const transaction = await tx.workspaceFinanceTransaction.create({ data: { workspaceId, kind: txKind, quality: "ACTUAL", amount, currency: goal.currency, occurredOn: date(input.occurredOn), label: input.label?.trim() || `${input.kind === "CONTRIBUTION" ? "Contribution to" : "Withdrawal from"} ${goal.name}`, category: "Savings", description: null } });
    const movement = await tx.workspaceFinanceGoalMovement.create({ data: { workspaceId, goalId, transactionId: transaction.id, kind: input.kind, amount, occurredOn: date(input.occurredOn) } });
    await event(tx, workspaceId, input.kind === "CONTRIBUTION" ? "GOAL_CONTRIBUTION" : "GOAL_WITHDRAWAL", "GOAL", goalId, ["currentAmount"]);
    const updatedGoal = await tx.workspaceFinanceGoal.findFirst({ where: { id: goalId, workspaceId }, select: { currentAmount: true } });
    return { movement, transaction, currentAmount: updatedGoal?.currentAmount.toString() ?? "0" };
  });
}

export async function createDebtPayment(ownerUserId: string, debtId: string, input: { amount: string; principalAmount: string; interestAmount: string; occurredOn: string; label?: string }) {
  return withWorkspace(ownerUserId, async (tx, workspaceId) => {
    const debt = await tx.workspaceFinanceDebt.findFirst({ where: { id: debtId, workspaceId, archivedAt: null } });
    if (!debt) return null;
    const total = dec(input.amount); const principal = dec(input.principalAmount); const interest = dec(input.interestAmount);
    if (!isFinanceCurrency(debt.currency) || parseFinanceAmount(input.amount, debt.currency) <= BigInt(0) || parseFinanceAmount(input.principalAmount, debt.currency) < BigInt(0) || parseFinanceAmount(input.interestAmount, debt.currency) < BigInt(0) || !parseFinanceDate(input.occurredOn) || (input.label?.length ?? 0) > 120) throw new Error("Payment fields are invalid.");
    if (!principal.plus(interest).equals(total)) throw new Error("Payment split must equal the recorded total payment.");
    const changed = await tx.workspaceFinanceDebt.updateMany({ where: { id: debtId, workspaceId, outstandingBalance: { gte: principal } }, data: { outstandingBalance: { decrement: principal } } });
    if (changed.count !== 1) throw new Error("Principal payment exceeds the outstanding balance or changed concurrently.");
    const transaction = await tx.workspaceFinanceTransaction.create({ data: { workspaceId, kind: "DEBT_REPAYMENT", quality: "ACTUAL", amount: total, currency: debt.currency, occurredOn: date(input.occurredOn), label: input.label?.trim() || `Repayment: ${debt.name}`, category: "Debt repayment" } });
    const payment = await tx.workspaceFinanceDebtPayment.create({ data: { workspaceId, debtId, transactionId: transaction.id, principalAmount: principal, interestAmount: interest, occurredOn: date(input.occurredOn) } });
    await event(tx, workspaceId, "DEBT_PAYMENT_RECORDED", "DEBT", debtId, ["outstandingBalance", "paymentHistory"]);
    const updatedDebt = await tx.workspaceFinanceDebt.findFirst({ where: { id: debtId, workspaceId }, select: { outstandingBalance: true } });
    return { payment, transaction, outstandingBalance: updatedDebt?.outstandingBalance.toString() ?? "0" };
  });
}

export async function createNextRecurringOccurrence(ownerUserId: string, scheduleId: string) {
  return withWorkspace(ownerUserId, async (tx, workspaceId) => {
    const schedule = await tx.workspaceFinanceRecurringSchedule.findFirst({ where: { id: scheduleId, workspaceId, active: true } });
    if (!schedule) return null;
    const occurrenceOn = schedule.nextOn;
    const transaction = await tx.workspaceFinanceTransaction.create({ data: { workspaceId, recurringScheduleId: schedule.id, recurrenceOn: occurrenceOn, kind: schedule.kind, quality: schedule.quality, amount: schedule.amount, currency: schedule.currency, occurredOn: occurrenceOn, label: schedule.label, category: schedule.category, fromAccount: schedule.fromAccount, toAccount: schedule.toAccount } });
    const updated = await tx.workspaceFinanceRecurringSchedule.updateMany({ where: { id: schedule.id, workspaceId, active: true, nextOn: occurrenceOn }, data: { nextOn: nextDate(occurrenceOn, schedule.frequency, schedule.interval) } });
    if (updated.count !== 1) throw new Error("Recurring schedule changed concurrently; refresh before retrying.");
    await event(tx, workspaceId, "RECURRING_OCCURRENCE_CREATED", "RECURRING", schedule.id, ["transaction", "nextOn"]);
    return { transaction, nextOn: nextDate(occurrenceOn, schedule.frequency, schedule.interval) };
  });
}
