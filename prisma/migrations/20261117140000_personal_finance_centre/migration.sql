CREATE TYPE "WorkspaceFinanceRecordKind" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'SAVINGS_CONTRIBUTION', 'SAVINGS_WITHDRAWAL', 'DEBT_REPAYMENT', 'ASSET_ACQUISITION', 'ASSET_DISPOSAL');
CREATE TYPE "WorkspaceFinanceQuality" AS ENUM ('ACTUAL', 'ESTIMATE', 'PLANNED');
CREATE TYPE "WorkspaceFinancePositionKind" AS ENUM ('ASSET', 'LIABILITY');
CREATE TYPE "WorkspaceFinanceGoalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "WorkspaceFinanceGoalMovementKind" AS ENUM ('CONTRIBUTION', 'WITHDRAWAL');
CREATE TYPE "WorkspaceFinanceInterestType" AS ENUM ('FIXED', 'VARIABLE', 'UNKNOWN');
CREATE TYPE "WorkspaceFinanceRepaymentFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'IRREGULAR');
CREATE TYPE "WorkspaceFinanceRecurringFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'ANNUAL');
CREATE TYPE "WorkspaceFinanceReminderKind" AS ENUM ('BILL_PAYMENT', 'DEBT_REPAYMENT', 'SAVINGS_CONTRIBUTION', 'FINANCIAL_REVIEW', 'BUDGET_CHECK_IN');
CREATE TYPE "WorkspaceFinanceReminderStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DISMISSED');

CREATE TABLE "WorkspaceFinanceTransaction" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "WorkspaceFinanceRecordKind" NOT NULL,
    "quality" "WorkspaceFinanceQuality" NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "occurredOn" DATE NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "category" VARCHAR(64) NOT NULL,
    "subcategory" VARCHAR(64),
    "paymentMethod" VARCHAR(48),
    "description" VARCHAR(500),
    "notes" VARCHAR(2000),
    "fromAccount" VARCHAR(80),
    "toAccount" VARCHAR(80),
    "recurringScheduleId" TEXT,
    "recurrenceOn" DATE,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceFinanceTransaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkspaceFinanceTransaction_amount_positive_check" CHECK ("amount" > 0),
    CONSTRAINT "WorkspaceFinanceTransaction_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "WorkspaceFinancePosition" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "WorkspaceFinancePositionKind" NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "category" VARCHAR(64) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "value" DECIMAL(20,4) NOT NULL,
    "quality" "WorkspaceFinanceQuality" NOT NULL,
    "valuedOn" DATE NOT NULL,
    "notes" VARCHAR(2000),
    "archivedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceFinancePosition_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkspaceFinancePosition_value_nonnegative_check" CHECK ("value" >= 0),
    CONSTRAINT "WorkspaceFinancePosition_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "WorkspaceFinanceValuation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "value" DECIMAL(20,4) NOT NULL,
    "quality" "WorkspaceFinanceQuality" NOT NULL,
    "valuedOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceFinanceValuation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkspaceFinanceValuation_value_nonnegative_check" CHECK ("value" >= 0)
);

CREATE TABLE "WorkspaceFinanceBudget" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "category" VARCHAR(64) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "limitAmount" DECIMAL(20,4) NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceFinanceBudget_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkspaceFinanceBudget_limit_positive_check" CHECK ("limitAmount" > 0),
    CONSTRAINT "WorkspaceFinanceBudget_dates_check" CHECK ("endsOn" >= "startsOn"),
    CONSTRAINT "WorkspaceFinanceBudget_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "WorkspaceFinanceGoal" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000),
    "currency" CHAR(3) NOT NULL,
    "targetAmount" DECIMAL(20,4) NOT NULL,
    "currentAmount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "targetOn" DATE,
    "status" "WorkspaceFinanceGoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceFinanceGoal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkspaceFinanceGoal_target_positive_check" CHECK ("targetAmount" > 0),
    CONSTRAINT "WorkspaceFinanceGoal_current_nonnegative_check" CHECK ("currentAmount" >= 0),
    CONSTRAINT "WorkspaceFinanceGoal_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "WorkspaceFinanceGoalMovement" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "kind" "WorkspaceFinanceGoalMovementKind" NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "occurredOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceFinanceGoalMovement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkspaceFinanceGoalMovement_amount_positive_check" CHECK ("amount" > 0)
);

CREATE TABLE "WorkspaceFinanceDebt" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "lenderDescription" VARCHAR(160),
    "currency" CHAR(3) NOT NULL,
    "originalPrincipal" DECIMAL(20,4) NOT NULL,
    "outstandingBalance" DECIMAL(20,4) NOT NULL,
    "annualInterestRate" DECIMAL(9,6),
    "interestType" "WorkspaceFinanceInterestType" NOT NULL DEFAULT 'UNKNOWN',
    "repaymentFrequency" "WorkspaceFinanceRepaymentFrequency" NOT NULL DEFAULT 'IRREGULAR',
    "repaymentAmount" DECIMAL(20,4),
    "nextDueOn" DATE,
    "notes" VARCHAR(2000),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceFinanceDebt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkspaceFinanceDebt_principal_nonnegative_check" CHECK ("originalPrincipal" >= 0),
    CONSTRAINT "WorkspaceFinanceDebt_balance_nonnegative_check" CHECK ("outstandingBalance" >= 0),
    CONSTRAINT "WorkspaceFinanceDebt_rate_check" CHECK ("annualInterestRate" IS NULL OR ("annualInterestRate" >= 0 AND "annualInterestRate" <= 100)),
    CONSTRAINT "WorkspaceFinanceDebt_repayment_positive_check" CHECK ("repaymentAmount" IS NULL OR "repaymentAmount" > 0),
    CONSTRAINT "WorkspaceFinanceDebt_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "WorkspaceFinanceDebtPayment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "principalAmount" DECIMAL(20,4) NOT NULL,
    "interestAmount" DECIMAL(20,4) NOT NULL,
    "occurredOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceFinanceDebtPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkspaceFinanceDebtPayment_amounts_check" CHECK ("principalAmount" >= 0 AND "interestAmount" >= 0 AND "principalAmount" + "interestAmount" > 0)
);

CREATE TABLE "WorkspaceFinanceRecurringSchedule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "WorkspaceFinanceRecordKind" NOT NULL,
    "quality" "WorkspaceFinanceQuality" NOT NULL DEFAULT 'PLANNED',
    "amount" DECIMAL(20,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "category" VARCHAR(64) NOT NULL,
    "frequency" "WorkspaceFinanceRecurringFrequency" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "nextOn" DATE NOT NULL,
    "fromAccount" VARCHAR(80),
    "toAccount" VARCHAR(80),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceFinanceRecurringSchedule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkspaceFinanceRecurringSchedule_amount_positive_check" CHECK ("amount" > 0),
    CONSTRAINT "WorkspaceFinanceRecurringSchedule_interval_check" CHECK ("interval" BETWEEN 1 AND 99),
    CONSTRAINT "WorkspaceFinanceRecurringSchedule_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "WorkspaceFinanceReminder" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "taskId" TEXT,
    "kind" "WorkspaceFinanceReminderKind" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "timezone" VARCHAR(80) NOT NULL,
    "status" "WorkspaceFinanceReminderStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceFinanceReminder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceFinanceEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "action" VARCHAR(48) NOT NULL,
    "targetType" VARCHAR(48) NOT NULL,
    "targetId" VARCHAR(128) NOT NULL,
    "changedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceFinanceEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceFinanceAttachment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceFinanceAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkspaceFinanceTransaction_workspaceId_occurredOn_currency_idx" ON "WorkspaceFinanceTransaction"("workspaceId", "occurredOn", "currency", "deletedAt");
CREATE INDEX "WorkspaceFinanceTransaction_workspaceId_kind_occurredOn_del_idx" ON "WorkspaceFinanceTransaction"("workspaceId", "kind", "occurredOn", "deletedAt");
CREATE INDEX "WorkspaceFinanceTransaction_workspaceId_category_occurredOn_idx" ON "WorkspaceFinanceTransaction"("workspaceId", "category", "occurredOn");
CREATE UNIQUE INDEX "WorkspaceFinanceTransaction_workspaceId_id_key" ON "WorkspaceFinanceTransaction"("workspaceId", "id");
CREATE UNIQUE INDEX "WorkspaceFinanceTransaction_recurring_occurrence_key" ON "WorkspaceFinanceTransaction"("workspaceId", "recurringScheduleId", "recurrenceOn") WHERE ("recurrenceOn" IS NOT NULL);
CREATE INDEX "WorkspaceFinancePosition_workspaceId_kind_archivedAt_curren_idx" ON "WorkspaceFinancePosition"("workspaceId", "kind", "archivedAt", "currency");
CREATE INDEX "WorkspaceFinancePosition_workspaceId_valuedOn_idx" ON "WorkspaceFinancePosition"("workspaceId", "valuedOn");
CREATE UNIQUE INDEX "WorkspaceFinancePosition_workspaceId_id_key" ON "WorkspaceFinancePosition"("workspaceId", "id");
CREATE INDEX "WorkspaceFinanceValuation_workspaceId_positionId_valuedOn_i_idx" ON "WorkspaceFinanceValuation"("workspaceId", "positionId", "valuedOn", "id");
CREATE INDEX "WorkspaceFinanceBudget_workspaceId_startsOn_endsOn_currency_idx" ON "WorkspaceFinanceBudget"("workspaceId", "startsOn", "endsOn", "currency", "archivedAt");
CREATE INDEX "WorkspaceFinanceBudget_workspaceId_category_currency_starts_idx" ON "WorkspaceFinanceBudget"("workspaceId", "category", "currency", "startsOn", "endsOn");
CREATE UNIQUE INDEX "WorkspaceFinanceBudget_workspaceId_name_category_currency_s_key" ON "WorkspaceFinanceBudget"("workspaceId", "name", "category", "currency", "startsOn", "endsOn");
CREATE INDEX "WorkspaceFinanceGoal_workspaceId_status_targetOn_updatedAt_idx" ON "WorkspaceFinanceGoal"("workspaceId", "status", "targetOn", "updatedAt");
CREATE UNIQUE INDEX "WorkspaceFinanceGoal_workspaceId_id_key" ON "WorkspaceFinanceGoal"("workspaceId", "id");
CREATE UNIQUE INDEX "WorkspaceFinanceGoalMovement_transactionId_key" ON "WorkspaceFinanceGoalMovement"("transactionId");
CREATE INDEX "WorkspaceFinanceGoalMovement_workspaceId_goalId_occurredOn__idx" ON "WorkspaceFinanceGoalMovement"("workspaceId", "goalId", "occurredOn", "id");
CREATE UNIQUE INDEX "WorkspaceFinanceGoalMovement_workspaceId_transactionId_key" ON "WorkspaceFinanceGoalMovement"("workspaceId", "transactionId");
CREATE INDEX "WorkspaceFinanceDebt_workspaceId_archivedAt_currency_idx" ON "WorkspaceFinanceDebt"("workspaceId", "archivedAt", "currency");
CREATE INDEX "WorkspaceFinanceDebt_workspaceId_nextDueOn_idx" ON "WorkspaceFinanceDebt"("workspaceId", "nextDueOn");
CREATE UNIQUE INDEX "WorkspaceFinanceDebt_workspaceId_id_key" ON "WorkspaceFinanceDebt"("workspaceId", "id");
CREATE UNIQUE INDEX "WorkspaceFinanceDebtPayment_transactionId_key" ON "WorkspaceFinanceDebtPayment"("transactionId");
CREATE INDEX "WorkspaceFinanceDebtPayment_workspaceId_debtId_occurredOn_i_idx" ON "WorkspaceFinanceDebtPayment"("workspaceId", "debtId", "occurredOn", "id");
CREATE UNIQUE INDEX "WorkspaceFinanceDebtPayment_workspaceId_transactionId_key" ON "WorkspaceFinanceDebtPayment"("workspaceId", "transactionId");
CREATE INDEX "WorkspaceFinanceRecurringSchedule_workspaceId_active_nextOn_idx" ON "WorkspaceFinanceRecurringSchedule"("workspaceId", "active", "nextOn");
CREATE UNIQUE INDEX "WorkspaceFinanceRecurringSchedule_workspaceId_id_key" ON "WorkspaceFinanceRecurringSchedule"("workspaceId", "id");
CREATE INDEX "WorkspaceFinanceReminder_workspaceId_status_remindAt_idx" ON "WorkspaceFinanceReminder"("workspaceId", "status", "remindAt");
CREATE UNIQUE INDEX "WorkspaceFinanceReminder_workspaceId_id_key" ON "WorkspaceFinanceReminder"("workspaceId", "id");
CREATE INDEX "WorkspaceFinanceEvent_workspaceId_targetType_targetId_creat_idx" ON "WorkspaceFinanceEvent"("workspaceId", "targetType", "targetId", "createdAt");
CREATE INDEX "WorkspaceFinanceEvent_workspaceId_action_createdAt_idx" ON "WorkspaceFinanceEvent"("workspaceId", "action", "createdAt");
CREATE INDEX "WorkspaceFinanceAttachment_workspaceId_transactionId_createdAt_idx" ON "WorkspaceFinanceAttachment"("workspaceId", "transactionId", "createdAt");
CREATE UNIQUE INDEX "WorkspaceFinanceAttachment_workspaceId_transactionId_mediaAssetId_key" ON "WorkspaceFinanceAttachment"("workspaceId", "transactionId", "mediaAssetId");

ALTER TABLE "WorkspaceFinanceTransaction" ADD CONSTRAINT "WorkspaceFinanceTransaction_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceFinanceTransaction" ADD CONSTRAINT "WorkspaceFinanceTransaction_workspaceId_recurringScheduleI_fkey" FOREIGN KEY ("workspaceId", "recurringScheduleId") REFERENCES "WorkspaceFinanceRecurringSchedule"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkspaceFinancePosition" ADD CONSTRAINT "WorkspaceFinancePosition_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceFinanceValuation" ADD CONSTRAINT "WorkspaceFinanceValuation_workspaceId_positionId_fkey" FOREIGN KEY ("workspaceId", "positionId") REFERENCES "WorkspaceFinancePosition"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceFinanceBudget" ADD CONSTRAINT "WorkspaceFinanceBudget_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceFinanceGoal" ADD CONSTRAINT "WorkspaceFinanceGoal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceFinanceGoalMovement" ADD CONSTRAINT "WorkspaceFinanceGoalMovement_workspaceId_goalId_fkey" FOREIGN KEY ("workspaceId", "goalId") REFERENCES "WorkspaceFinanceGoal"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceFinanceGoalMovement" ADD CONSTRAINT "WorkspaceFinanceGoalMovement_workspaceId_transactionId_fkey" FOREIGN KEY ("workspaceId", "transactionId") REFERENCES "WorkspaceFinanceTransaction"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkspaceFinanceDebt" ADD CONSTRAINT "WorkspaceFinanceDebt_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceFinanceDebtPayment" ADD CONSTRAINT "WorkspaceFinanceDebtPayment_workspaceId_debtId_fkey" FOREIGN KEY ("workspaceId", "debtId") REFERENCES "WorkspaceFinanceDebt"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceFinanceDebtPayment" ADD CONSTRAINT "WorkspaceFinanceDebtPayment_workspaceId_transactionId_fkey" FOREIGN KEY ("workspaceId", "transactionId") REFERENCES "WorkspaceFinanceTransaction"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkspaceFinanceRecurringSchedule" ADD CONSTRAINT "WorkspaceFinanceRecurringSchedule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceFinanceReminder" ADD CONSTRAINT "WorkspaceFinanceReminder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceFinanceReminder" ADD CONSTRAINT "WorkspaceFinanceReminder_workspaceId_taskId_fkey" FOREIGN KEY ("workspaceId", "taskId") REFERENCES "WorkspaceTask"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkspaceFinanceEvent" ADD CONSTRAINT "WorkspaceFinanceEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceFinanceAttachment" ADD CONSTRAINT "WorkspaceFinanceAttachment_workspaceId_transactionId_fkey" FOREIGN KEY ("workspaceId", "transactionId") REFERENCES "WorkspaceFinanceTransaction"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceFinanceAttachment" ADD CONSTRAINT "WorkspaceFinanceAttachment_workspaceId_mediaAssetId_fkey" FOREIGN KEY ("workspaceId", "mediaAssetId") REFERENCES "WorkspaceMediaAsset"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
