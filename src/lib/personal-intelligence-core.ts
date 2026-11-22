export const INTELLIGENCE_SOURCES = ["TASKS", "PROJECTS", "ACADEMICS", "WORKSPACE_PREFERENCES", "PERSONAL_MEMORY", "CALENDAR_DIARY", "PERSONAL_FINANCE", "WORKSPACE_PAGES", "WORKSPACE_DATABASES", "NUTRITION"] as const;
export type IntelligenceSource = (typeof INTELLIGENCE_SOURCES)[number];
export const INTELLIGENCE_PERMISSION_KEYS = [
  "TASKS", "PROJECTS", "ACADEMICS", "WORKSPACE_PREFERENCES", "CALENDAR_DIARY", "PERSONAL_FINANCE",
  "PERSONAL_GOALS_PREFERENCES", "PERSONAL_MEMORY", "SECURITY_METADATA", "FUTURE_MODULES", "WORKSPACE_PAGES", "WORKSPACE_DATABASES", "NUTRITION",
] as const;
export type IntelligencePermissionKey = (typeof INTELLIGENCE_PERMISSION_KEYS)[number];
export type IntelligencePermissionSet = Record<IntelligencePermissionKey, boolean>;
export const DEFAULT_INTELLIGENCE_PERMISSIONS: IntelligencePermissionSet = {
  TASKS: false, PROJECTS: false, ACADEMICS: false, WORKSPACE_PREFERENCES: false, CALENDAR_DIARY: false,
  PERSONAL_FINANCE: false, PERSONAL_GOALS_PREFERENCES: false, PERSONAL_MEMORY: false,
  SECURITY_METADATA: false, FUTURE_MODULES: false,
  WORKSPACE_PAGES: false, WORKSPACE_DATABASES: false, NUTRITION: false,
};

export type IntelligenceFeedback = Record<string, "helpful" | "not-helpful">;

export const MAX_SAVED_INSIGHT_IDS = 100;
const MAX_INSIGHT_ID_LENGTH = 512;

export function normalizeIntelligencePermissions(input: unknown): IntelligencePermissionSet {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return { ...DEFAULT_INTELLIGENCE_PERMISSIONS };
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return { ...DEFAULT_INTELLIGENCE_PERMISSIONS };
    const keys = Reflect.ownKeys(input);
    if (keys.some((key) => typeof key !== "string" || !INTELLIGENCE_PERMISSION_KEYS.includes(key as IntelligencePermissionKey))) return { ...DEFAULT_INTELLIGENCE_PERMISSIONS };
    const output = { ...DEFAULT_INTELLIGENCE_PERMISSIONS };
    for (const key of keys as IntelligencePermissionKey[]) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "boolean") return { ...DEFAULT_INTELLIGENCE_PERMISSIONS };
      output[key] = descriptor.value;
    }
    return output;
  } catch {
    return { ...DEFAULT_INTELLIGENCE_PERMISSIONS };
  }
}

export function parseDismissedInsightIds(input: unknown): string[] | null {
  if (!Array.isArray(input) || input.length > MAX_SAVED_INSIGHT_IDS) return null;
  const output: string[] = [];
  for (const value of input) {
    if (typeof value !== "string" || value.length === 0 || value.length > MAX_INSIGHT_ID_LENGTH || /[\u0000-\u001f\u007f]/.test(value)) return null;
    if (!output.includes(value)) output.push(value);
  }
  return output;
}

export function parseIntelligenceFeedback(input: unknown): IntelligenceFeedback | null {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(input);
    if (keys.length > MAX_SAVED_INSIGHT_IDS || keys.some((key) => typeof key !== "string" || key.length === 0 || key.length > MAX_INSIGHT_ID_LENGTH || /[\u0000-\u001f\u007f]/.test(key) || ["__proto__", "constructor", "prototype"].includes(key))) return null;
    const output: IntelligenceFeedback = Object.create(null) as IntelligenceFeedback;
    for (const key of keys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (!descriptor || !("value" in descriptor) || (descriptor.value !== "helpful" && descriptor.value !== "not-helpful")) return null;
      output[key] = descriptor.value;
    }
    return output;
  } catch {
    return null;
  }
}

export function parseIntelligencePermissionSet(input: unknown): IntelligencePermissionSet | null {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Object.keys(input);
    if (keys.length !== INTELLIGENCE_PERMISSION_KEYS.length || keys.some((key) => !INTELLIGENCE_PERMISSION_KEYS.includes(key as IntelligencePermissionKey))) return null;
    const output = {} as IntelligencePermissionSet;
    for (const key of INTELLIGENCE_PERMISSION_KEYS) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "boolean") return null;
      output[key] = descriptor.value;
    }
    return output;
  } catch {
    return null;
  }
}

export type IntelligenceRecordKind = "TASK" | "PROJECT" | "MILESTONE" | "ACADEMIC_ACTIVITY" | "WORKSPACE_PREFERENCE" | "PERSONAL_MEMORY" | "CALENDAR_REMINDER" | "FINANCE_RECORD" | "WORKSPACE_PAGE" | "WORKSPACE_DATABASE" | "NUTRITION_SUMMARY";
export type IntelligenceEvidence = {
  id: string;
  source: IntelligenceSource;
  kind: IntelligenceRecordKind;
  title: string;
  status: string;
  dueAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string;
  confidence: "OWNER_ENTERED" | "DERIVED_FROM_OWNER_RECORDS";
  destination: string;
};

export type PersonalInsight = {
  id: string;
  type: "OVERDUE" | "UPCOMING" | "SCHEDULE_CONFLICT" | "PERSONAL_CONTEXT" | "LIMITATION";
  observation: string;
  whyItMatters: string;
  evidence: Array<{ title: string; source: IntelligenceSource; recordedAt: string; confidence: "OWNER_ENTERED" | "DERIVED_FROM_OWNER_RECORDS" }>;
  certainty: "Derived from the selected records" | "Insufficient selected information";
  suggestedAction: string;
  potentialConsequence: string;
  destination: string | null;
};

const MAX_RECORDS_PER_SOURCE = 200;
const MAX_TITLE_LENGTH = 180;

function safeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, MAX_TITLE_LENGTH) : null;
}

function scaledDecimal(value: unknown): bigint | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const match = /^(-?)(0|[1-9]\d*)(?:\.(\d{1,4}))?$/.exec(String(value));
  if (!match) return null;
  const scale = BigInt(10_000); const fraction = BigInt((match[3] ?? "").padEnd(4, "0") || "0");
  const result = BigInt(match[2]) * scale + fraction;
  return match[1] ? -result : result;
}

function isoDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function dueDate(row: Record<string, unknown>): string | null {
  if (row.dueAt !== undefined && row.dueAt !== null) return isoDate(row.dueAt);
  if (row.dueOn instanceof Date && Number.isFinite(row.dueOn.getTime())) return row.dueOn.toISOString().slice(0, 10);
  if (typeof row.dueOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.dueOn)) return row.dueOn;
  return isoDate(row.dueOn ?? row.targetAt);
}

function list(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_RECORDS_PER_SOURCE).filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item));
}

export function parseIntelligenceSources(input: unknown): IntelligenceSource[] | null {
  if (!Array.isArray(input) || input.length > INTELLIGENCE_SOURCES.length) return null;
  if (input.some((item) => typeof item !== "string" || !INTELLIGENCE_SOURCES.includes(item as IntelligenceSource))) return null;
  const sources = input as IntelligenceSource[];
  if (new Set(sources).size !== sources.length) return null;
  return [...sources];
}

/** Normalize only explicitly selected, owner-scoped records into a bounded safe context. */
export function normalizePersonalContext(input: {
  selectedSources: readonly IntelligenceSource[];
  tasks?: unknown;
  projects?: unknown;
  milestones?: unknown;
  academicActivities?: unknown;
  workspacePreferences?: unknown;
  personalMemories?: unknown;
  calendarReminders?: unknown;
  workspacePages?: unknown;
  workspaceDatabases?: unknown;
  finance?: unknown;
  nutritionSummary?: unknown;
}): IntelligenceEvidence[] {
  const output: IntelligenceEvidence[] = [];
  const append = (rows: Array<Record<string, unknown>>, source: IntelligenceSource, kind: IntelligenceRecordKind, destination: string) => {
    for (const row of rows) {
      const id = safeText(row.id);
      const memoryText = source === "PERSONAL_MEMORY" && typeof row.content === "string" ? `: ${row.content}` : "";
      const title = safeText(`${String(row.title ?? row.name ?? row.label ?? "")}${memoryText}`);
      const updatedAt = isoDate(row.updatedAt);
      if (!id || !title || !updatedAt) continue;
      output.push({ id, source, kind, title, status: safeText(row.status) ?? "UNKNOWN", dueAt: dueDate(row), startsAt: isoDate(row.startsAt), endsAt: isoDate(row.endsAt ?? (kind === "TASK" && row.startsAt ? row.dueAt : null)), updatedAt, confidence: "OWNER_ENTERED", destination });
    }
  };
  if (input.selectedSources.includes("TASKS")) append(list(input.tasks), "TASKS", "TASK", "/dashboard/workspace/tasks");
  if (input.selectedSources.includes("PROJECTS")) {
    append(list(input.projects), "PROJECTS", "PROJECT", "/dashboard/workspace/projects");
    append(list(input.milestones), "PROJECTS", "MILESTONE", "/dashboard/workspace/projects");
  }
  if (input.selectedSources.includes("ACADEMICS")) append(list(input.academicActivities), "ACADEMICS", "ACADEMIC_ACTIVITY", "/dashboard/workspace/academics");
  if (input.selectedSources.includes("WORKSPACE_PREFERENCES")) {
    const preference = list([input.workspacePreferences])[0];
    const updatedAt = preference ? isoDate(preference.updatedAt) : null;
    if (preference && updatedAt) {
      const safeMode = safeText(preference.mode);
      const safeTimezone = safeText(preference.timezone);
      const start = safeText(preference.workingHoursStart);
      const end = safeText(preference.workingHoursEnd);
      const focus = Array.isArray(preference.focusAreas) ? preference.focusAreas.map(safeText).filter((item): item is string => item !== null).slice(0, 8) : [];
      const parts = [safeMode ? `Workspace mode: ${safeMode}` : null, safeTimezone ? `Timezone: ${safeTimezone}` : null, start && end ? `Working hours: ${start}–${end}` : null, focus.length ? `Focus areas: ${focus.join(", ")}` : null].filter((part): part is string => part !== null);
      if (parts.length) output.push({ id: "workspace-preferences", source: "WORKSPACE_PREFERENCES", kind: "WORKSPACE_PREFERENCE", title: parts.join(" · ").slice(0, MAX_TITLE_LENGTH), status: "USER_PROVIDED", dueAt: null, startsAt: null, endsAt: null, updatedAt, confidence: "OWNER_ENTERED", destination: "/dashboard/workspace" });
    }
  }
  if (input.selectedSources.includes("PERSONAL_MEMORY")) {
    append(list(input.personalMemories), "PERSONAL_MEMORY", "PERSONAL_MEMORY", "/dashboard/workspace/intelligence");
  }
  if (input.selectedSources.includes("CALENDAR_DIARY")) {
    const reminders = list(input.calendarReminders);
    for (const row of reminders) {
      const id = safeText(row.id);
      const title = safeText(row.pageTitle) ?? "Workspace reminder";
      const remindAt = isoDate(row.remindAt);
      const updatedAt = isoDate(row.updatedAt);
      if (id && remindAt && updatedAt) output.push({ id, source: "CALENDAR_DIARY", kind: "CALENDAR_REMINDER", title, status: safeText(row.status) ?? "SCHEDULED", dueAt: remindAt, startsAt: null, endsAt: null, updatedAt, confidence: "OWNER_ENTERED", destination: "/dashboard/workspace/calendar" });
    }
  }
  if (input.selectedSources.includes("PERSONAL_FINANCE")) {
    const finance = list([input.finance])[0];
    const updatedAt = finance ? isoDate(finance.updatedAt) ?? isoDate(list(finance.history)[0]?.createdAt) : null;
    const appendFinance = (rows: unknown, kind: "budget" | "goal" | "debt" | "reminder") => {
      for (const row of list(rows)) {
        const id = safeText(row.id); const recordUpdatedAt = isoDate(row.updatedAt) ?? updatedAt;
        if (!id || !recordUpdatedAt) continue;
        const currency = safeText(row.currency);
        const category = safeText(row.category ?? row.name ?? row.title) ?? `Recorded ${kind}`;
        const percent = typeof row.percent === "number" && Number.isFinite(row.percent) ? row.percent : null;
        const dueAt = kind === "reminder" ? isoDate(row.remindAt) : kind === "goal" ? isoDate(row.targetOn) : kind === "debt" ? isoDate(row.nextDueOn) : null;
        const targetAt = kind === "goal" ? dueAt : null;
        const lowGoalProgress = kind === "goal" && typeof row.progressPercent === "number" && row.progressPercent < 20 && targetAt !== null && dayMs(targetAt) >= Date.now() && dayMs(targetAt) <= Date.now() + 90 * 86_400_000;
        const debtIncomplete = kind === "debt" && (row.interestType === "UNKNOWN" || row.repaymentAmount === null || row.repaymentAmount === undefined || !row.nextDueOn);
        const status = kind === "budget" && percent !== null && percent > 100 ? "BUDGET_OVERRUN" : lowGoalProgress ? "GOAL_PROGRESS_LOW" : debtIncomplete ? "FINANCIAL_RECORD_INCOMPLETE" : safeText(row.status) ?? "RECORDED";
        output.push({ id, source: "PERSONAL_FINANCE", kind: "FINANCE_RECORD", title: `${kind}: ${category}${currency ? ` (${currency})` : ""}`, status, dueAt, startsAt: null, endsAt: null, updatedAt: recordUpdatedAt, confidence: "OWNER_ENTERED", destination: "/dashboard/workspace/finance" });
      }
    };
    if (finance) {
      appendFinance(finance.budgets, "budget"); appendFinance(finance.goals, "goal"); appendFinance(finance.debts, "debt"); appendFinance(finance.reminders, "reminder");
      const summaryRows = list(finance.summary);
      for (const row of summaryRows) {
        const currency = safeText(row.currency); const income = scaledDecimal(row.actualIncome); const expenses = scaledDecimal(row.actualExpenses);
        if (currency && income !== null && expenses !== null && expenses > income && updatedAt) output.push({ id: `cashflow:${currency}`, source: "PERSONAL_FINANCE", kind: "FINANCE_RECORD", title: `Recorded cash flow (${currency})`, status: "CASH_FLOW_NEGATIVE", dueAt: null, startsAt: null, endsAt: null, updatedAt, confidence: "DERIVED_FROM_OWNER_RECORDS", destination: "/dashboard/workspace/finance" });
      }
    }
  }
  if (input.selectedSources.includes("WORKSPACE_PAGES")) append(list(input.workspacePages), "WORKSPACE_PAGES", "WORKSPACE_PAGE", "/dashboard/workspace/pages");
  if (input.selectedSources.includes("WORKSPACE_DATABASES")) append(list(input.workspaceDatabases), "WORKSPACE_DATABASES", "WORKSPACE_DATABASE", "/dashboard/workspace/databases");
  if (input.selectedSources.includes("NUTRITION")) {
    const summary = list([input.nutritionSummary])[0];
    const updatedAt = summary ? isoDate(summary.updatedAt) : null;
    const mealCount = summary && typeof summary.mealCount === "number" && Number.isSafeInteger(summary.mealCount) && summary.mealCount >= 0 ? summary.mealCount : null;
    const planCount = summary && typeof summary.planCount === "number" && Number.isSafeInteger(summary.planCount) && summary.planCount >= 0 ? summary.planCount : null;
    if (updatedAt && mealCount !== null && planCount !== null) output.push({ id: "nutrition-summary", source: "NUTRITION", kind: "NUTRITION_SUMMARY", title: `Recorded nutrition activity: ${mealCount} meals and ${planCount} active plans`, status: "OWNER_RECORDED", dueAt: null, startsAt: null, endsAt: null, updatedAt, confidence: "DERIVED_FROM_OWNER_RECORDS", destination: "/dashboard/workspace/nutrition" });
  }
  return output;
}

function evidenceFor(record: IntelligenceEvidence) {
  return { title: record.title, source: record.source, recordedAt: record.updatedAt, confidence: record.confidence };
}

function dayMs(value: string) { return new Date(value).getTime(); }

export function derivePersonalInsights(records: readonly IntelligenceEvidence[], now = new Date()): PersonalInsight[] {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error("A valid reference time is required.");
  const horizon = nowMs + 7 * 24 * 60 * 60 * 1000;
  const active = records.filter((record) => !["COMPLETED", "CANCELLED"].includes(record.status));
  const personalMemory = records.filter((record) => record.source === "PERSONAL_MEMORY");
  const overdueAll = active.filter((record) => record.dueAt && dayMs(record.dueAt) < nowMs).sort((a, b) => dayMs(a.dueAt!) - dayMs(b.dueAt!));
  const upcomingAll = active.filter((record) => record.dueAt && dayMs(record.dueAt) >= nowMs && dayMs(record.dueAt) <= horizon).sort((a, b) => dayMs(a.dueAt!) - dayMs(b.dueAt!));
  const overdue = overdueAll.slice(0, 4);
  const upcoming = upcomingAll.slice(0, 4);
  const insights: PersonalInsight[] = [];
  const budgetOverruns = records.filter((record) => record.source === "PERSONAL_FINANCE" && record.status === "BUDGET_OVERRUN");
  if (budgetOverruns.length) insights.push({ id: `finance-budget-overrun:${budgetOverruns.map((item) => `${item.id}:${item.updatedAt}`).join(":")}`, type: "PERSONAL_CONTEXT", observation: `${budgetOverruns.length} selected recorded budget${budgetOverruns.length === 1 ? " is" : "s are"} above its entered limit.`, whyItMatters: "This compares your entered expense records with your saved budget limits; it does not assess affordability or recommend a financial product.", evidence: budgetOverruns.slice(0, 5).map(evidenceFor), certainty: "Derived from the selected records", suggestedAction: "Review the budget and its transactions in Finance Centre; correct any entries that are incomplete or miscategorised.", potentialConsequence: "An incomplete ledger may overstate or understate the displayed utilisation.", destination: "/dashboard/workspace/finance" });
  const negativeCashflow = records.filter((record) => record.source === "PERSONAL_FINANCE" && record.status === "CASH_FLOW_NEGATIVE");
  if (negativeCashflow.length) insights.push({ id: `finance-cashflow:${negativeCashflow.map((item) => `${item.id}:${item.updatedAt}`).join(":")}`, type: "PERSONAL_CONTEXT", observation: `For ${negativeCashflow.map((item) => item.title.match(/\(([^)]+)\)/)?.[1]).filter(Boolean).join(", ")}, selected-period recorded expenses exceed recorded income.`, whyItMatters: "This is a calculation from selected ledger entries; missing, estimated, or uncategorised entries can change the result.", evidence: negativeCashflow.slice(0, 5).map(evidenceFor), certainty: "Derived from the selected records", suggestedAction: "Review the date range and actual versus planned entries in Finance Centre.", potentialConsequence: "A partial ledger should not be treated as a complete financial position.", destination: "/dashboard/workspace/finance" });
  const lowGoalProgress = records.filter((record) => record.source === "PERSONAL_FINANCE" && record.status === "GOAL_PROGRESS_LOW");
  if (lowGoalProgress.length) insights.push({ id: `finance-goal-progress:${lowGoalProgress.map((item) => `${item.id}:${item.updatedAt}`).join(":")}`, type: "PERSONAL_CONTEXT", observation: `${lowGoalProgress.length} selected savings goal${lowGoalProgress.length === 1 ? " has" : "s have"} a target date within three months and less than 20% of its target recorded.`, whyItMatters: "Goal progress is based only on contributions and withdrawals entered in Finance Centre.", evidence: lowGoalProgress.slice(0, 5).map(evidenceFor), certainty: "Derived from the selected records", suggestedAction: "Review the target date and recorded goal movements; change the plan only if it still reflects your intention.", potentialConsequence: "Missing contributions or an outdated target date can make the displayed progress incomplete.", destination: "/dashboard/workspace/finance" });
  const incompleteFinance = records.filter((record) => record.source === "PERSONAL_FINANCE" && record.status === "FINANCIAL_RECORD_INCOMPLETE");
  if (incompleteFinance.length) insights.push({ id: `finance-incomplete:${incompleteFinance.map((item) => `${item.id}:${item.updatedAt}`).join(":")}`, type: "LIMITATION", observation: `${incompleteFinance.length} selected debt record${incompleteFinance.length === 1 ? " has" : "s have"} incomplete repayment assumptions.`, whyItMatters: "At least one record has an unknown rate, repayment amount, or due date; payoff projections are therefore not inferred.", evidence: incompleteFinance.slice(0, 5).map(evidenceFor), certainty: "Insufficient selected information", suggestedAction: "Complete the missing debt assumptions in Finance Centre if you want a more informative view.", potentialConsequence: "Incomplete terms make debt trend and payoff estimates unreliable.", destination: "/dashboard/workspace/finance" });
  if (overdueAll.length) insights.push({ id: `overdue:${overdueAll.length}:${overdue.map((item) => `${item.id}:${item.dueAt}:${item.updatedAt}`).join(":")}`, type: "OVERDUE", observation: `${overdueAll.length} selected item${overdueAll.length === 1 ? " is" : "s are"} past the recorded due date${overdueAll.length > overdue.length ? ` (showing ${overdue.length})` : ""}.`, whyItMatters: "A quick review can help you decide whether to complete, reschedule, or update the source record.", evidence: overdue.map(evidenceFor), certainty: "Derived from the selected records", suggestedAction: overdue.some((item) => item.source === "ACADEMICS") ? "Review the academic item and status, then choose a realistic next step or study block in the planner." : "Review the listed items and choose one realistic next step in its original module.", potentialConsequence: "Leaving dates unchanged may make future planning less reliable.", destination: overdue[0]?.destination ?? null });
  if (upcomingAll.length) insights.push({ id: `upcoming:${upcomingAll.length}:${upcoming.map((item) => `${item.id}:${item.dueAt}:${item.updatedAt}`).join(":")}`, type: "UPCOMING", observation: `${upcomingAll.length} selected item${upcomingAll.length === 1 ? " has" : "s have"} a due date within the next seven days${upcomingAll.length > upcoming.length ? ` (showing ${upcoming.length})` : ""}.`, whyItMatters: "These dates come from your selected workspace records and may deserve a place in your plan.", evidence: upcoming.map(evidenceFor), certainty: "Derived from the selected records", suggestedAction: "Open the source items and check whether the available time matches the work required.", potentialConsequence: "If several items need attention, planning them early may reduce last-minute pressure.", destination: upcoming[0]?.destination ?? null });

  const timed = active.filter((record) => record.startsAt && record.endsAt && dayMs(record.endsAt) > dayMs(record.startsAt)).sort((a, b) => dayMs(a.startsAt!) - dayMs(b.startsAt!));
  let conflict: [IntelligenceEvidence, IntelligenceEvidence] | null = null;
  for (let leftIndex = 0; leftIndex < timed.length && !conflict; leftIndex++) {
    const left = timed[leftIndex];
    if (!left.endsAt) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < timed.length; rightIndex++) {
      const right = timed[rightIndex];
      if (!right.startsAt || dayMs(right.startsAt) >= dayMs(left.endsAt)) break;
      if (dayMs(right.startsAt) < dayMs(left.endsAt) && right.endsAt && dayMs(right.endsAt) > dayMs(left.startsAt!)) {
        conflict = [left, right];
        break;
      }
    }
  }
  if (conflict) {
    const pair = conflict;
    insights.push({ id: `conflict:${pair[0].id}:${pair[0].startsAt}:${pair[0].endsAt}:${pair[0].updatedAt}:${pair[1].id}:${pair[1].startsAt}:${pair[1].endsAt}:${pair[1].updatedAt}`, type: "SCHEDULE_CONFLICT", observation: "Two selected timed records overlap.", whyItMatters: "The stored start and end times overlap; this does not establish your full availability.", evidence: pair.map(evidenceFor), certainty: "Derived from the selected records", suggestedAction: "Review both source records and adjust one only if the overlap is unintended.", potentialConsequence: "Leaving an unintended overlap may make both commitments harder to meet.", destination: pair[0].destination });
  }
  if (personalMemory.length) insights.push({ id: `memory:${personalMemory.map((item) => `${item.id}:${item.updatedAt}`).join(":")}`, type: "PERSONAL_CONTEXT", observation: `You chose to include ${personalMemory.length} saved personal context note${personalMemory.length === 1 ? "" : "s"} in this request.`, whyItMatters: "These notes were written by you and are shown as context, not independently verified facts or inferred traits.", evidence: personalMemory.slice(0, 6).map(evidenceFor), certainty: "Derived from the selected records", suggestedAction: "Review or update saved context in Personal Intelligence settings if it is no longer accurate.", potentialConsequence: "Out-of-date notes can make later reflections less relevant.", destination: "/dashboard/workspace/intelligence" });
  if (insights.length === 0) insights.push({ id: "context:limited", type: "LIMITATION", observation: records.length ? "No due-date or timed conflict pattern was found in the selected records." : "There is not enough selected workspace information to make a personal observation.", whyItMatters: "This view only uses source categories you enabled for this request and does not infer missing details.", evidence: [], certainty: "Insufficient selected information", suggestedAction: records.length ? "Add or update dates in the source modules if you want deadline guidance." : "Choose one or more context sources, or continue without contextual guidance.", potentialConsequence: "Without relevant records, a specific recommendation would be a guess.", destination: null });
  return insights;
}

export function answerWithoutPersonalRecords(question: string): PersonalInsight[] | null {
  const normalized = question.trim().toLowerCase();
  if (/finance|financial|money|budget|saving|debt|income|expense|wealth/.test(normalized)) return [{ id: "limitation:finance", type: "LIMITATION", observation: "Personal finance context is not available to this answer until you enable and select it.", whyItMatters: "Finance observations are generated only when the authenticated owner has enabled and explicitly selected the Personal Finance source.", evidence: [], certainty: "Insufficient selected information", suggestedAction: "Review the Finance Centre directly or enable its context permission before asking for record-based observations; do not treat an ungrounded answer as a saved balance.", potentialConsequence: "A financial conclusion without selected, dated records could be misleading.", destination: "/dashboard/workspace/finance" }];
  if (/password|security|breach|mfa|authenticator/.test(normalized)) return [{ id: "limitation:security", type: "LIMITATION", observation: "Password candidates and security-analyser state are never included in personal context.", whyItMatters: "This protects credentials and avoids implying that account security has been independently verified.", evidence: [], certainty: "Insufficient selected information", suggestedAction: "Use the Security Analyser for local education and review account-security settings separately.", potentialConsequence: "A strength heuristic cannot confirm password reuse, breaches, or account protections.", destination: "/dashboard/workspace/security" }];
  return null;
}

export function answerPersonalQuestion(question: string, records: readonly IntelligenceEvidence[], now = new Date()): PersonalInsight[] {
  const independent = answerWithoutPersonalRecords(question);
  if (independent) return independent;
  return derivePersonalInsights(records, now);
}
