export const FINANCE_CURRENCIES = ["KES", "USD", "EUR", "GBP", "JPY", "KWD", "BHD", "OMR", "TND", "AED", "AUD", "CAD", "CHF", "CNY", "INR", "NGN", "ZAR", "UGX", "TZS", "RWF", "GHS", "XAF", "XOF", "BRL", "MXN", "NZD", "SGD", "SAR", "QAR", "ETB"] as const;
export type FinanceCurrency = (typeof FINANCE_CURRENCIES)[number];
export type FinanceKind = "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE";
export type FinanceConfidence = "ACTUAL" | "ESTIMATE" | "PLANNED";
export type FinanceCadence = "ONE_TIME" | "MONTHLY" | "ANNUAL";

export type FinanceEntry = {
  id: string;
  kind: FinanceKind;
  confidence: FinanceConfidence;
  currency: FinanceCurrency;
  amount: string;
  cadence: FinanceCadence;
  category: string;
  label: string;
};

export type FinanceGoal = {
  id: string;
  label: string;
  currency: FinanceCurrency;
  current: string;
  target: string;
};

export type FinanceBudget = {
  id: string;
  category: string;
  currency: FinanceCurrency;
  limit: string;
};

export type FinanceCurrencySummary = {
  currency: FinanceCurrency;
  actualAssets: bigint;
  actualLiabilities: bigint;
  estimatedAssets: bigint;
  estimatedLiabilities: bigint;
  actualMonthlyIncome: bigint;
  actualMonthlyExpenses: bigint;
  plannedMonthlyIncome: bigint;
  plannedMonthlyExpenses: bigint;
};

export const FINANCE_RECORD_KINDS = ["INCOME", "EXPENSE", "TRANSFER", "SAVINGS_CONTRIBUTION", "SAVINGS_WITHDRAWAL", "DEBT_REPAYMENT", "ASSET_ACQUISITION", "ASSET_DISPOSAL"] as const;
export const FINANCE_QUALITIES = ["ACTUAL", "ESTIMATE", "PLANNED"] as const;
export const FINANCE_POSITION_KINDS = ["ASSET", "LIABILITY"] as const;
export type FinanceTransactionKind = (typeof FINANCE_RECORD_KINDS)[number];
export type FinanceQuality = (typeof FINANCE_QUALITIES)[number];
export type FinancePositionKind = (typeof FINANCE_POSITION_KINDS)[number];

export function isFinanceCurrency(value: unknown): value is FinanceCurrency {
  return typeof value === "string" && (FINANCE_CURRENCIES as readonly string[]).includes(value);
}

export function parseFinanceDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day ? value : null;
}

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const textField = (value: unknown, max: number, required = false): value is string => typeof value === "string" && value.length <= max && (!required || value.trim().length > 0);
const hasOnly = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).every((key) => fields.includes(key));
const optionalText = (value: Record<string, unknown>, key: string, max: number) => value[key] === undefined || value[key] === null || (typeof value[key] === "string" && (value[key] as string).length <= max);

export type FinanceTransactionDraft = {
  kind: FinanceTransactionKind; quality: FinanceQuality; amount: string; currency: FinanceCurrency; occurredOn: string;
  label: string; category: string; subcategory?: string | null; paymentMethod?: string | null; description?: string | null;
  notes?: string | null; fromAccount?: string | null; toAccount?: string | null;
};

export function parseFinanceTransactionDraft(input: unknown) {
  const fields = ["kind", "quality", "amount", "currency", "occurredOn", "label", "category", "subcategory", "paymentMethod", "description", "notes", "fromAccount", "toAccount"];
  if (!object(input) || !hasOnly(input, fields) || !FINANCE_RECORD_KINDS.includes(input.kind as FinanceTransactionKind) || !FINANCE_QUALITIES.includes(input.quality as FinanceQuality) || !isFinanceCurrency(input.currency) || !parseFinanceDate(input.occurredOn) || !textField(input.label, 120, true) || !textField(input.category, 64, true) || !optionalText(input, "subcategory", 64) || !optionalText(input, "paymentMethod", 48) || !optionalText(input, "description", 500) || !optionalText(input, "notes", 2000) || !optionalText(input, "fromAccount", 80) || !optionalText(input, "toAccount", 80)) return { success: false as const, message: "Transaction fields are invalid." };
  if (input.kind === "TRANSFER" && (!textField(input.fromAccount, 80, true) || !textField(input.toAccount, 80, true) || input.fromAccount.trim() === input.toAccount.trim())) return { success: false as const, message: "Transfers require two different account labels." };
  try { if (parseFinanceAmount(input.amount as string, input.currency) <= BigInt(0)) throw new Error(); } catch { return { success: false as const, message: "Amount must be positive and valid for this currency." }; }
  const kind = input.kind as FinanceTransactionKind;
  const quality = input.quality as FinanceQuality;
  if (["DEBT_REPAYMENT", "SAVINGS_CONTRIBUTION", "SAVINGS_WITHDRAWAL"].includes(kind)) return { success: false as const, message: "Use the linked debt or savings action for this transaction type." };
  if (["ASSET_ACQUISITION", "ASSET_DISPOSAL"].includes(kind) && quality !== "ACTUAL") return { success: false as const, message: "Asset acquisitions and disposals must be actual entries." };
  return { success: true as const, value: { ...input, amount: (input.amount as string).trim(), label: (input.label as string).trim(), category: (input.category as string).trim(), occurredOn: input.occurredOn as string } as FinanceTransactionDraft };
}

export function parseFinancePositionDraft(input: unknown) {
  const fields = ["kind", "label", "category", "currency", "value", "quality", "valuedOn", "notes"];
  if (!object(input) || !hasOnly(input, fields) || !FINANCE_POSITION_KINDS.includes(input.kind as FinancePositionKind) || !FINANCE_QUALITIES.includes(input.quality as FinanceQuality) || input.quality === "PLANNED" || !isFinanceCurrency(input.currency) || !parseFinanceDate(input.valuedOn) || !textField(input.label, 120, true) || !textField(input.category, 64, true) || !optionalText(input, "notes", 2000)) return { success: false as const, message: "Position fields are invalid." };
  try { parseFinanceAmount(input.value as string, input.currency); } catch { return { success: false as const, message: "Value or currency is invalid." }; }
  return { success: true as const, value: input as { kind: FinancePositionKind; label: string; category: string; currency: FinanceCurrency; value: string; quality: "ACTUAL" | "ESTIMATE"; valuedOn: string; notes?: string | null } };
}

export function parseFinanceBudgetDraft(input: unknown) {
  const fields = ["name", "category", "currency", "limitAmount", "startsOn", "endsOn"];
  if (!object(input) || !hasOnly(input, fields) || !textField(input.name, 120, true) || !textField(input.category, 64, true) || !isFinanceCurrency(input.currency) || !parseFinanceDate(input.startsOn) || !parseFinanceDate(input.endsOn) || (input.startsOn as string) > (input.endsOn as string)) return { success: false as const, message: "Budget fields or date range are invalid." };
  try { if (parseFinanceAmount(input.limitAmount as string, input.currency) <= BigInt(0)) throw new Error(); } catch { return { success: false as const, message: "Budget amount must be positive." }; }
  return { success: true as const, value: input as { name: string; category: string; currency: FinanceCurrency; limitAmount: string; startsOn: string; endsOn: string } };
}

export function parseFinanceGoalDraft(input: unknown) {
  const fields = ["name", "description", "currency", "targetAmount", "targetOn"];
  if (!object(input) || !hasOnly(input, fields) || !textField(input.name, 120, true) || !optionalText(input, "description", 1000) || !isFinanceCurrency(input.currency) || (input.targetOn !== undefined && input.targetOn !== null && !parseFinanceDate(input.targetOn))) return { success: false as const, message: "Savings goal fields are invalid." };
  try { if (parseFinanceAmount(input.targetAmount as string, input.currency) <= BigInt(0)) throw new Error(); } catch { return { success: false as const, message: "Goal target must be positive." }; }
  return { success: true as const, value: input as { name: string; description?: string | null; currency: FinanceCurrency; targetAmount: string; targetOn?: string | null } };
}

export function parseFinanceDebtDraft(input: unknown) {
  const fields = ["name", "lenderDescription", "currency", "originalPrincipal", "outstandingBalance", "annualInterestRate", "interestType", "repaymentFrequency", "repaymentAmount", "nextDueOn", "notes"];
  const interestTypes = ["FIXED", "VARIABLE", "UNKNOWN"];
  const frequencies = ["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL", "IRREGULAR"];
  if (!object(input) || !hasOnly(input, fields) || !textField(input.name, 120, true) || !optionalText(input, "lenderDescription", 160) || !isFinanceCurrency(input.currency) || !interestTypes.includes(String(input.interestType)) || !frequencies.includes(String(input.repaymentFrequency)) || (input.nextDueOn !== undefined && input.nextDueOn !== null && !parseFinanceDate(input.nextDueOn)) || !optionalText(input, "notes", 2000)) return { success: false as const, message: "Debt fields are invalid." };
  try {
    parseFinanceAmount(input.originalPrincipal as string, input.currency);
    parseFinanceAmount(input.outstandingBalance as string, input.currency);
    if (input.repaymentAmount !== undefined && input.repaymentAmount !== null && parseFinanceAmount(input.repaymentAmount as string, input.currency) <= BigInt(0)) return { success: false as const, message: "Repayment amount must be positive." };
    if (input.annualInterestRate !== undefined && input.annualInterestRate !== null && (typeof input.annualInterestRate !== "string" || !/^(?:0|[1-9]\d?)(?:\.\d{1,6})?$/.test(input.annualInterestRate) || Number(input.annualInterestRate) > 100)) return { success: false as const, message: "Annual interest rate must be between 0 and 100 percent." };
  } catch { return { success: false as const, message: "Debt amounts or currency are invalid." }; }
  return { success: true as const, value: input as Record<string, unknown> };
}

export function parseFinanceRecurringDraft(input: unknown) {
  const fields = ["kind", "amount", "currency", "label", "category", "frequency", "interval", "nextOn", "fromAccount", "toAccount"];
  const kinds = ["INCOME", "EXPENSE", "TRANSFER"];
  if (!object(input) || !hasOnly(input, fields) || !kinds.includes(String(input.kind)) || !isFinanceCurrency(input.currency) || !textField(input.label, 120, true) || !textField(input.category, 64, true) || !["WEEKLY", "MONTHLY", "ANNUAL"].includes(String(input.frequency)) || !Number.isInteger(input.interval) || (input.interval as number) < 1 || (input.interval as number) > 99 || !parseFinanceDate(input.nextOn) || !optionalText(input, "fromAccount", 80) || !optionalText(input, "toAccount", 80)) return { success: false as const, message: "Recurring schedule fields are invalid." };
  if (input.kind === "TRANSFER" && (!textField(input.fromAccount, 80, true) || !textField(input.toAccount, 80, true) || input.fromAccount.trim() === input.toAccount.trim())) return { success: false as const, message: "Transfers require two different account labels." };
  try { if (parseFinanceAmount(input.amount as string, input.currency) <= BigInt(0)) throw new Error(); } catch { return { success: false as const, message: "Recurring amount must be positive." }; }
  return { success: true as const, value: input as Record<string, unknown> };
}

export function parseFinanceReminderDraft(input: unknown) {
  const fields = ["kind", "title", "remindAt", "timezone", "taskId"];
  const kinds = ["BILL_PAYMENT", "DEBT_REPAYMENT", "SAVINGS_CONTRIBUTION", "FINANCIAL_REVIEW", "BUDGET_CHECK_IN"];
  if (!object(input) || !hasOnly(input, fields) || !kinds.includes(String(input.kind)) || !textField(input.title, 120, true) || typeof input.remindAt !== "string" || !Number.isFinite(new Date(input.remindAt).getTime()) || input.remindAt.length > 40 || typeof input.timezone !== "string" || input.timezone.length > 80 || !optionalText(input, "taskId", 128)) return { success: false as const, message: "Finance reminder fields are invalid." };
  try { new Intl.DateTimeFormat("en", { timeZone: input.timezone as string }); } catch { return { success: false as const, message: "Reminder timezone is invalid." }; }
  return { success: true as const, value: input as Record<string, unknown> };
}

/** Validate partial updates using the same field rules as creation. Unknown fields are never persisted. */
export function parseFinanceUpdate(resource: string, input: unknown) {
  if (!object(input) || Object.keys(input).length === 0) return { success: false as const, message: "Update fields are invalid." };
  const allowed: Record<string, readonly string[]> = {
    transactions: ["kind", "quality", "amount", "currency", "occurredOn", "label", "category", "subcategory", "paymentMethod", "description", "notes", "fromAccount", "toAccount"],
    positions: ["kind", "label", "category", "currency", "value", "quality", "valuedOn", "notes", "expectedRevision"],
    budgets: ["name", "category", "currency", "limitAmount", "startsOn", "endsOn"],
    goals: ["name", "description", "currency", "targetAmount", "targetOn"],
    debts: ["name", "lenderDescription", "currency", "originalPrincipal", "outstandingBalance", "annualInterestRate", "interestType", "repaymentFrequency", "repaymentAmount", "nextDueOn", "notes"],
    recurring: ["kind", "quality", "amount", "currency", "label", "category", "frequency", "interval", "nextOn", "fromAccount", "toAccount", "active"],
    reminders: ["kind", "title", "remindAt", "timezone", "taskId"],
  };
  const fields = allowed[resource];
  if (!fields || !hasOnly(input, fields) || Object.keys(input).some((key) => key !== "expectedRevision" && input[key] === undefined)) return { success: false as const, message: "Unsupported finance update." };
  const dateField = (key: string) => input[key] === undefined || input[key] === null || parseFinanceDate(input[key]);
  const textFields: Record<string, number> = { label: 120, name: 120, title: 120, category: 64, subcategory: 64, paymentMethod: 48, description: 500, notes: 2000, lenderDescription: 160, fromAccount: 80, toAccount: 80 };
  for (const [key, max] of Object.entries(textFields)) if (input[key] !== undefined && input[key] !== null && !textField(input[key], max, ["label", "name", "title", "category"].includes(key))) return { success: false as const, message: "Finance text fields are invalid." };
  if (input.currency !== undefined && !isFinanceCurrency(input.currency)) return { success: false as const, message: "Unsupported currency." };
  if (input.kind !== undefined && ![...FINANCE_RECORD_KINDS, ...FINANCE_POSITION_KINDS].includes(input.kind as never)) return { success: false as const, message: "Finance record type is invalid." };
  if (resource === "transactions" && ["DEBT_REPAYMENT", "SAVINGS_CONTRIBUTION", "SAVINGS_WITHDRAWAL"].includes(String(input.kind))) return { success: false as const, message: "Use the linked debt or savings action for this transaction type." };
  if (resource === "transactions" && input.kind !== undefined && ["ASSET_ACQUISITION", "ASSET_DISPOSAL"].includes(String(input.kind)) && input.quality !== "ACTUAL") return { success: false as const, message: "Asset acquisitions and disposals must be actual entries." };
  if (input.quality !== undefined && !FINANCE_QUALITIES.includes(input.quality as FinanceQuality)) return { success: false as const, message: "Record quality is invalid." };
  if (input.value !== undefined || input.amount !== undefined || input.limitAmount !== undefined || input.targetAmount !== undefined || input.originalPrincipal !== undefined || input.outstandingBalance !== undefined || input.repaymentAmount !== undefined) {
    const amountKey = ["value", "amount", "limitAmount", "targetAmount", "originalPrincipal", "outstandingBalance", "repaymentAmount"].find((key) => input[key] !== undefined);
    if (amountKey && (typeof input[amountKey] !== "string" || !isFinanceCurrency(input.currency))) return { success: false as const, message: "Finance amount is invalid." };
    try { if (amountKey) { const parsedAmount = parseFinanceAmount(input[amountKey] as string, input.currency as FinanceCurrency); if (amountKey !== "outstandingBalance" && parsedAmount <= BigInt(0)) return { success: false as const, message: "Finance amount must be positive." }; } } catch { return { success: false as const, message: "Finance amount is invalid." }; }
  }
  for (const key of ["occurredOn", "valuedOn", "startsOn", "endsOn", "targetOn", "nextDueOn", "nextOn"]) if (input[key] !== undefined && !dateField(key)) return { success: false as const, message: "Finance date is invalid." };
  if (resource === "positions" && input.quality === "PLANNED") return { success: false as const, message: "Positions must be actual or estimated." };
  if (resource === "budgets" && input.startsOn && input.endsOn && String(input.startsOn) > String(input.endsOn)) return { success: false as const, message: "Budget dates are invalid." };
  if (resource === "transactions" && input.quality === "ESTIMATE" && input.kind && ["INCOME", "EXPENSE"].includes(String(input.kind))) return { success: false as const, message: "Cash-flow transactions must be actual or planned." };
  if (resource === "transactions" && input.quality === "PLANNED" && input.kind && ["ASSET_ACQUISITION", "ASSET_DISPOSAL"].includes(String(input.kind))) return { success: false as const, message: "Asset actions cannot be planned ledger entries." };
  if (resource === "positions" && input.expectedRevision !== undefined && (!Number.isInteger(input.expectedRevision) || (input.expectedRevision as number) < 0)) return { success: false as const, message: "Position revision is invalid." };
  if (resource === "recurring" && input.active !== undefined && typeof input.active !== "boolean") return { success: false as const, message: "Schedule state is invalid." };
  if (resource === "reminders" && input.remindAt !== undefined && (typeof input.remindAt !== "string" || !Number.isFinite(Date.parse(input.remindAt)))) return { success: false as const, message: "Reminder date is invalid." };
  if (input.annualInterestRate !== undefined && input.annualInterestRate !== null && (typeof input.annualInterestRate !== "string" || !/^(?:0|[1-9]\d?)(?:\.\d{1,6})?$/.test(input.annualInterestRate) || Number(input.annualInterestRate) > 100)) return { success: false as const, message: "Interest rate is invalid." };
  const copy = Object.fromEntries(Object.entries(input).filter(([key]) => key !== "expectedRevision"));
  return { success: true as const, value: { ...copy, ...(input.expectedRevision !== undefined ? { expectedRevision: input.expectedRevision } : {}) } };
}

const threeDigitCurrencies = new Set(["BHD", "KWD", "OMR", "TND"]);
const zeroDigitCurrencies = new Set(["BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG", "RWF", "UGX", "UYI", "VND", "VUV", "XAF", "XOF", "XPF"]);
function minorDigits(currency: string): number { return zeroDigitCurrencies.has(currency) ? 0 : threeDigitCurrencies.has(currency) ? 3 : 2; }

/** Parse user-entered decimal money exactly; floating-point arithmetic is never used. */
export function parseFinanceAmount(value: string, currency: FinanceCurrency): bigint {
  if (!/^[A-Z]{3}$/.test(currency) || typeof value !== "string") throw new Error("Unsupported amount or currency.");
  const digits = minorDigits(currency);
  const pattern = digits === 0 ? /^(?:0|[1-9]\d*)(?:\.0+)?$/ : new RegExp(`^(?:0|[1-9]\\d*)(?:\\.\\d{1,${digits}})?$`);
  const wholePart = value.split(".", 1)[0];
  // Finance amounts are stored in DECIMAL(20,4): at most 16 whole digits.
  if (value.length > 24 || wholePart.length > 16 || !pattern.test(value)) throw new Error("Enter a valid non-negative amount for this currency.");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(10) ** BigInt(digits) + BigInt((fraction + "0".repeat(digits)).slice(0, digits) || "0");
}

export type MonthlyDebtPayoffEstimate = { months: number; totalInterestMinor: bigint };

/**
 * Illustrative monthly amortisation using integer minor units and half-up
 * interest rounding. Returns null unless the terms explicitly support a fixed,
 * monthly estimate. This is not a lender statement or financial advice.
 */
export function estimateMonthlyDebtPayoff(input: {
  balance: string;
  payment: string;
  annualRatePercent: string;
  currency: FinanceCurrency;
  fixedRate: boolean;
  monthlyFrequency: boolean;
  maxMonths?: number;
}): MonthlyDebtPayoffEstimate | null {
  if (!input.fixedRate || !input.monthlyFrequency || !/^(?:0|[1-9]\d?)(?:\.\d{1,6})?$/.test(input.annualRatePercent)) return null;
  const maxMonths = input.maxMonths ?? 1200;
  if (!Number.isSafeInteger(maxMonths) || maxMonths < 1 || maxMonths > 1200) return null;
  let balance: bigint;
  let payment: bigint;
  try {
    balance = parseFinanceAmount(input.balance, input.currency);
    payment = parseFinanceAmount(input.payment, input.currency);
  } catch { return null; }
  if (balance <= BigInt(0) || payment <= BigInt(0)) return null;

  const [whole, fraction = ""] = input.annualRatePercent.split(".");
  const million = BigInt(1_000_000);
  const annualRateMillionths = BigInt(whole) * million + BigInt((fraction + "000000").slice(0, 6));
  const interestDenominator = BigInt(1200) * million;
  let totalInterestMinor = BigInt(0);
  for (let months = 1; months <= maxMonths; months++) {
    const numerator = balance * annualRateMillionths;
    const interest = (numerator + interestDenominator / BigInt(2)) / interestDenominator;
    if (payment <= interest) return null;
    totalInterestMinor += interest;
    balance = balance + interest - payment;
    if (balance <= BigInt(0)) return { months, totalInterestMinor };
  }
  return null;
}

export function formatFinanceAmount(minor: bigint, currency: FinanceCurrency): string {
  const digits = minorDigits(currency);
  const scale = BigInt(10) ** BigInt(digits);
  const sign = minor < BigInt(0) ? "-" : "";
  const absolute = minor < BigInt(0) ? -minor : minor;
  const whole = absolute / scale;
  if (digits === 0) return `${currency} ${sign}${whole.toString()}`;
  const fraction = (absolute % scale).toString().padStart(digits, "0");
  return `${currency} ${sign}${whole.toString()}.${fraction}`;
}

function monthlyAmount(entry: FinanceEntry): bigint {
  const amount = parseFinanceAmount(entry.amount, entry.currency);
  if (entry.cadence === "MONTHLY") return amount;
  if (entry.cadence === "ANNUAL") return amount / BigInt(12);
  return BigInt(0);
}

export function summarizeFinance(entries: FinanceEntry[]): FinanceCurrencySummary[] {
  const summaries = new Map<FinanceCurrency, FinanceCurrencySummary>();
  for (const currency of FINANCE_CURRENCIES) {
    summaries.set(currency, { currency, actualAssets: BigInt(0), actualLiabilities: BigInt(0), estimatedAssets: BigInt(0), estimatedLiabilities: BigInt(0), actualMonthlyIncome: BigInt(0), actualMonthlyExpenses: BigInt(0), plannedMonthlyIncome: BigInt(0), plannedMonthlyExpenses: BigInt(0) });
  }
  for (const entry of entries) {
    const summary = summaries.get(entry.currency);
    if (!summary) continue;
    const amount = parseFinanceAmount(entry.amount, entry.currency);
    if (entry.kind === "ASSET") {
      if (entry.confidence === "ACTUAL") summary.actualAssets += amount;
      if (entry.confidence === "ESTIMATE") summary.estimatedAssets += amount;
    } else if (entry.kind === "LIABILITY") {
      if (entry.confidence === "ACTUAL") summary.actualLiabilities += amount;
      if (entry.confidence === "ESTIMATE") summary.estimatedLiabilities += amount;
    } else if (entry.kind === "INCOME") {
      const monthly = monthlyAmount(entry);
      if (entry.confidence === "ACTUAL") summary.actualMonthlyIncome += monthly;
      if (entry.confidence === "PLANNED") summary.plannedMonthlyIncome += monthly;
    } else if (entry.kind === "EXPENSE") {
      const monthly = monthlyAmount(entry);
      if (entry.confidence === "ACTUAL") summary.actualMonthlyExpenses += monthly;
      if (entry.confidence === "PLANNED") summary.plannedMonthlyExpenses += monthly;
    }
  }
  return [...summaries.values()].filter((item) => Object.entries(item).some(([key, value]) => key !== "currency" && typeof value === "bigint" && value !== BigInt(0)));
}

export function financeGoalProgress(goal: FinanceGoal): number {
  const target = parseFinanceAmount(goal.target, goal.currency);
  const current = parseFinanceAmount(goal.current, goal.currency);
  if (target <= BigInt(0)) throw new Error("A goal target must be greater than zero.");
  return Number((current * BigInt(10000) / target > BigInt(10000) ? BigInt(10000) : current * BigInt(10000) / target)) / 100;
}

export function financeBudgetUsage(budget: FinanceBudget, entries: FinanceEntry[]): { spent: bigint; remaining: bigint; percent: number } {
  const limit = parseFinanceAmount(budget.limit, budget.currency);
  const spent = entries.reduce((total, entry) => entry.kind === "EXPENSE" && entry.category === budget.category && entry.currency === budget.currency && entry.confidence === "ACTUAL" ? total + parseFinanceAmount(entry.amount, entry.currency) : total, BigInt(0));
  if (limit <= BigInt(0)) throw new Error("A budget limit must be greater than zero.");
  return { spent, remaining: limit - spent, percent: Number(spent * BigInt(10000) / limit) / 100 };
}
