export type LeadScoreComponent = "fit" | "intent" | "engagement" | "recency";

export type LeadScoreReason = {
  component: LeadScoreComponent;
  code: string;
  label: string;
  points: number;
};

export type LeadScoreEvent = {
  id: string;
  type: string;
  createdAt: Date | string;
  metadata?: Record<string, unknown> | null;
};

export type LeadScoreConsultation = {
  id: string;
  status: string;
  createdAt: Date | string;
  scheduledAt: Date | string;
  completedAt?: Date | string | null;
};

export type LeadScoreInput = {
  createdAt: Date | string;
  interestedIn?: string | null;
  serviceNames?: string[];
  decisionMaker?: boolean | null;
  budget?: string | null;
  timeline?: string | null;
  nextFollowUpAt?: Date | string | null;
  lastContactedAt?: Date | string | null;
  activities: LeadScoreEvent[];
  consultations: LeadScoreConsultation[];
};

export type LeadScoreResult = {
  total: number;
  components: {
    fit: number;
    intent: number;
    engagement: number;
    recency: number;
  };
  reasons: LeadScoreReason[];
  nextBestAction: string;
  temperature: "HOT" | "WARM" | "COLD" | "DORMANT";
  nextRefreshAt: Date | null;
};

const DAY = 24 * 60 * 60 * 1000;
const ENGAGEMENT_WINDOW = 90 * DAY;
const MAX_ENGAGEMENTS = 5;

function asDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const result = value instanceof Date ? value : new Date(value);
  return Number.isFinite(result.getTime()) ? result : null;
}

function normalizedText(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function consultationIsRelevant(status: string): boolean {
  return !["CANCELLED", "RESCHEDULED"].includes(status);
}

function consultationEventDate(
  consultation: LeadScoreConsultation,
): Date | null {
  return (
    asDate(consultation.completedAt) ??
    asDate(consultation.scheduledAt) ??
    asDate(consultation.createdAt)
  );
}

function nextBestAction(input: LeadScoreInput, now: Date, lastRelevantAt: Date) {
  const followUp = asDate(input.nextFollowUpAt);
  if (followUp && followUp.getTime() <= now.getTime()) {
    return "Complete the overdue follow-up and record the outcome.";
  }

  const pendingConsultation = input.consultations.some(
    (consultation) => consultation.status === "PENDING",
  );
  if (pendingConsultation) {
    return "Review the pending consultation and confirm the next step.";
  }

  const age = now.getTime() - lastRelevantAt.getTime();
  if (age >= 15 * DAY) {
    return "Re-engage the lead and confirm whether their needs have changed.";
  }

  if (normalizedText(input.interestedIn) && (!input.budget || !input.timeline)) {
    return "Ask a short discovery question to clarify budget and timing.";
  }

  if (normalizedText(input.interestedIn)) {
    return "Prepare a relevant recommendation for the stated interest.";
  }

  return "Learn what product or service would be useful to this lead.";
}

function calculateNextRefreshAt(
  lastRelevantAt: Date,
  engagementDates: Date[],
  consultationDates: Date[],
  nextFollowUpAt: Date | null,
  now: Date,
): Date | null {
  const candidates = [
    lastRelevantAt.getTime() + 4 * DAY,
    lastRelevantAt.getTime() + 8 * DAY,
    lastRelevantAt.getTime() + 15 * DAY,
    lastRelevantAt.getTime() + 31 * DAY,
    ...engagementDates.map((date) => date.getTime() + ENGAGEMENT_WINDOW + 1),
    ...consultationDates.map((date) => date.getTime() + ENGAGEMENT_WINDOW + 1),
    ...(nextFollowUpAt ? [nextFollowUpAt.getTime()] : []),
  ].filter((time) => time > now.getTime());

  return candidates.length ? new Date(Math.min(...candidates)) : null;
}

export function classifyLeadTemperature(
  total: number,
  recency: number,
): LeadScoreResult["temperature"] {
  if (recency === 0) return "DORMANT";
  if (total >= 70 && recency >= 8) return "HOT";
  if (total >= 45) return "WARM";
  return "COLD";
}

export function shouldApplyAutomaticTemperature(temperatureOverride: boolean) {
  return !temperatureOverride;
}

export function calculateLeadScore(
  input: LeadScoreInput,
  now = new Date(),
): LeadScoreResult {
  const reasons: LeadScoreReason[] = [];
  let fit = 0;
  let intent = 0;
  let engagement = 0;

  const interest = normalizedText(input.interestedIn);
  const serviceMatch = Boolean(
    interest && input.serviceNames?.some((name) => normalizedText(name) === interest),
  );
  if (serviceMatch) fit += 15;
  reasons.push({
    component: "fit",
    code: "service_match",
    label: serviceMatch
      ? "Interest exactly matches a portfolio service"
      : interest
        ? "No exact portfolio service match recorded"
        : "Product or service interest is unknown",
    points: serviceMatch ? 15 : 0,
  });

  if (input.decisionMaker === true) fit += 10;
  reasons.push({
    component: "fit",
    code: "decision_maker",
    label:
      input.decisionMaker === true
        ? "Decision-maker status confirmed"
        : input.decisionMaker === false
          ? "Not identified as the decision-maker"
          : "Decision-maker status is unknown",
    points: input.decisionMaker === true ? 10 : 0,
  });

  const budgetKnown = Boolean(normalizedText(input.budget));
  if (budgetKnown) intent += 10;
  reasons.push({
    component: "intent",
    code: "budget_stated",
    label: budgetKnown ? "Budget was provided" : "Budget is unknown",
    points: budgetKnown ? 10 : 0,
  });

  const timelineKnown = Boolean(normalizedText(input.timeline));
  if (timelineKnown) intent += 10;
  reasons.push({
    component: "intent",
    code: "timeline_stated",
    label: timelineKnown ? "Buying timeline was provided" : "Timeline is unknown",
    points: timelineKnown ? 10 : 0,
  });

  const consultationDates = input.consultations
    .filter((consultation) => consultationIsRelevant(consultation.status))
    .map((consultation) => asDate(consultation.createdAt))
    .filter((date): date is Date => Boolean(date));
  const activeConsultation = input.consultations.some((consultation) => {
    if (!consultationIsRelevant(consultation.status)) return false;
    const createdAt = asDate(consultation.createdAt);
    return Boolean(
      createdAt && now.getTime() - createdAt.getTime() <= ENGAGEMENT_WINDOW,
    );
  });
  if (activeConsultation) intent += 15;
  reasons.push({
    component: "intent",
    code: "consultation_requested",
    label: activeConsultation
      ? "Recent consultation request"
      : "No recent active consultation request",
    points: activeConsultation ? 15 : 0,
  });

  const engagementEvents = new Map<string, Date>();
  for (const activity of input.activities) {
    if (!["CALL", "EMAIL", "WHATSAPP", "MEETING"].includes(activity.type)) {
      continue;
    }
    const date = asDate(activity.createdAt);
    if (!date || now.getTime() - date.getTime() > ENGAGEMENT_WINDOW) continue;
    const outcome = normalizedText(
      typeof activity.metadata?.outcome === "string"
        ? activity.metadata.outcome
        : null,
    );
    if (["no answer", "awaiting response", "unanswered", "no response"].includes(outcome)) continue;

    const consultationId =
      typeof activity.metadata?.consultationId === "string"
        ? activity.metadata.consultationId
        : null;
    const eventKey = consultationId ? `consultation:${consultationId}` : activity.id;

    const previous = engagementEvents.get(eventKey);
    if (!previous || date.getTime() > previous.getTime()) {
      engagementEvents.set(eventKey, date);
    }
  }

  for (const consultation of input.consultations) {
    if (consultation.status !== "COMPLETED") continue;
    const date = consultationEventDate(consultation);
    if (!date || now.getTime() - date.getTime() > ENGAGEMENT_WINDOW) continue;
    const key = `consultation:${consultation.id}`;
    const previous = engagementEvents.get(key);
    if (!previous || date.getTime() > previous.getTime()) {
      engagementEvents.set(key, date);
    }
  }

  const lastContactedAt = asDate(input.lastContactedAt);
  const unsuccessfulContactDates = input.activities
    .filter((activity) => ["CALL", "EMAIL", "WHATSAPP"].includes(activity.type))
    .filter((activity) => {
      const outcome = normalizedText(
        typeof activity.metadata?.outcome === "string"
          ? activity.metadata.outcome
          : null,
      );
      return ["no answer", "awaiting response", "unanswered", "no response"].includes(outcome);
    })
    .map((activity) => asDate(activity.createdAt))
    .filter((date): date is Date => Boolean(date));
  // Contact logging writes lastContactedAt alongside its activity. Suppress the
  // legacy timestamp fallback only when it can be tied to an unsuccessful attempt.
  const lastContactWasUnsuccessful = Boolean(
    lastContactedAt &&
      unsuccessfulContactDates.some(
        (date) => Math.abs(date.getTime() - lastContactedAt.getTime()) < 60_000,
      ),
  );
  if (
    lastContactedAt &&
    now.getTime() - lastContactedAt.getTime() <= ENGAGEMENT_WINDOW &&
    !lastContactWasUnsuccessful &&
    ![...engagementEvents.values()].some(
      (date) => Math.abs(date.getTime() - lastContactedAt.getTime()) < 1000,
    )
  ) {
    engagementEvents.set("legacy-last-contact", lastContactedAt);
  }

  const engagementDates = [...engagementEvents.values()];
  const countedEngagements = engagementDates
    .filter((date) => date.getTime() <= now.getTime())
    .sort((left, right) => right.getTime() - left.getTime())
    .slice(0, MAX_ENGAGEMENTS);
  engagement = countedEngagements.length * 5;
  reasons.push({
    component: "engagement",
    code: "logged_engagements",
    label: `${countedEngagements.length} distinct logged contact or completed consultation event${countedEngagements.length === 1 ? "" : "s"} in the last 90 days (maximum 5)`,
    points: engagement,
  });

  const meaningfulDates = [
    asDate(input.createdAt),
    lastContactWasUnsuccessful ? null : lastContactedAt,
    ...engagementDates,
    ...input.consultations
      .filter((consultation) => consultationIsRelevant(consultation.status))
      .map((consultation) => asDate(consultation.createdAt)),
  ].filter((date): date is Date => Boolean(date && date.getTime() <= now.getTime()));
  const lastRelevantAt = meaningfulDates.reduce(
    (latest, date) => (date.getTime() > latest.getTime() ? date : latest),
    asDate(input.createdAt) ?? now,
  );

  const age = Math.max(0, now.getTime() - lastRelevantAt.getTime());
  const recency =
    age < 4 * DAY ? 15 : age < 8 * DAY ? 12 : age < 15 * DAY ? 8 : age < 31 * DAY ? 4 : 0;
  reasons.push({
    component: "recency",
    code: "last_meaningful_activity",
    label:
      recency === 0
        ? "No meaningful activity in the last 30 days"
        : `Most recent meaningful activity was ${Math.floor(age / DAY)} day${Math.floor(age / DAY) === 1 ? "" : "s"} ago`,
    points: recency,
  });

  const total = fit + intent + engagement + recency;
  return {
    total,
    components: { fit, intent, engagement, recency },
    reasons,
    nextBestAction: nextBestAction(input, now, lastRelevantAt),
    temperature: classifyLeadTemperature(total, recency),
    nextRefreshAt: calculateNextRefreshAt(
      lastRelevantAt,
      engagementDates,
      consultationDates,
      asDate(input.nextFollowUpAt),
      now,
    ),
  };
}
