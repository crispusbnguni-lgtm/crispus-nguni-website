import "server-only";

import { Prisma, type LeadSource, type LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculateLeadScore,
  shouldApplyAutomaticTemperature,
} from "@/lib/lead-scoring";
import {
  leadContactMatches,
} from "@/lib/lead-contacts";

type Transaction = Prisma.TransactionClient;

export async function invalidatePortfolioLeadScores(
  tx: Transaction,
  portfolioId: string,
) {
  await tx.lead.updateMany({
    where: { portfolioId },
    data: { scoreCalculatedAt: null, nextScoreRefreshAt: null },
  });
}

export type LeadDuplicateCandidate = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  status: LeadStatus;
  createdAt: Date;
};

export { normalizeLeadEmail, normalizeLeadPhone } from "@/lib/lead-contacts";

export async function lockLeadContacts(
  tx: Transaction,
  portfolioId: string,
  emailNormalized: string | null,
  phoneNormalized: string | null,
) {
  const keys = [
    emailNormalized ? `email:${emailNormalized}` : null,
    phoneNormalized ? `phone:${phoneNormalized}` : null,
  ]
    .filter((key): key is string => Boolean(key))
    .sort();

  for (const key of keys) {
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtext(${portfolioId}), hashtext(${key}))
  `;
}
}

export async function findLeadContactDuplicates(
  tx: Transaction,
  input: {
    portfolioId: string;
    emailNormalized: string | null;
    phoneNormalized: string | null;
    excludeLeadId?: string;
  },
): Promise<LeadDuplicateCandidate[]> {
  if (!input.emailNormalized && !input.phoneNormalized) return [];

  // Scan this personal portfolio so historical values written before
  // normalization are checked using the same canonicalizers as new records.
  const contactConditions: Prisma.LeadWhereInput[] = [];
  if (input.emailNormalized) {
    contactConditions.push(
      { emailNormalized: input.emailNormalized },
      { emailNormalized: null, email: { not: null } },
    );
  }
  if (input.phoneNormalized) {
    contactConditions.push(
      { phoneNormalized: input.phoneNormalized },
      { phoneNormalized: null, phone: { not: null } },
    );
  }

  const leads = await tx.lead.findMany({
    where: {
      portfolioId: input.portfolioId,
      OR: contactConditions,
      ...(input.excludeLeadId ? { id: { not: input.excludeLeadId } } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      emailNormalized: true,
      phone: true,
      phoneNormalized: true,
      source: true,
      status: true,
      createdAt: true,
    },
  });

  return leads
    .filter((lead) => {
      return leadContactMatches(lead, input);
    })
    .map((lead) => ({
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      status: lead.status,
      createdAt: lead.createdAt,
    }));
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function recalculateLeadScore(
  tx: Transaction,
  leadId: string,
  now = new Date(),
) {
  await tx.$queryRaw`
  WITH lock_acquired AS MATERIALIZED (
    SELECT pg_advisory_xact_lock(
      hashtext('lead-score'),
      hashtext(${leadId})
    )
  )
  SELECT 1::integer
  FROM lock_acquired
`;

  const lead = await tx.lead.findUnique({
    where: { id: leadId },
    include: {
      portfolio: { select: { services: { select: { title: true } } } },
      activities: {
        select: { id: true, type: true, createdAt: true, metadata: true },
      },
      consultations: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          scheduledAt: true,
          completedAt: true,
        },
      },
    },
  });

  if (!lead) return null;

  const result = calculateLeadScore(
    {
      createdAt: lead.createdAt,
      interestedIn: lead.interestedIn,
      serviceNames: lead.portfolio.services.map((service) => service.title),
      decisionMaker: lead.decisionMaker,
      budget: lead.budget,
      timeline: lead.timeline,
      nextFollowUpAt: lead.nextFollowUpAt,
      lastContactedAt: lead.lastContactedAt,
      activities: lead.activities.map((activity) => ({
        ...activity,
        metadata:
          activity.metadata && typeof activity.metadata === "object"
            ? (activity.metadata as Record<string, unknown>)
            : null,
      })),
      consultations: lead.consultations,
    },
    now,
  );

  const breakdown = {
    components: result.components,
    reasons: result.reasons,
    temperature: result.temperature,
  };
  const latest = await tx.leadScoreHistory.findFirst({
    where: { leadId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      totalScore: true,
      fitScore: true,
      intentScore: true,
      engagementScore: true,
      recencyScore: true,
      reasons: true,
      nextBestAction: true,
    },
  });

  const sameSnapshot = Boolean(
    latest &&
      latest.totalScore === result.total &&
      latest.fitScore === result.components.fit &&
      latest.intentScore === result.components.intent &&
      latest.engagementScore === result.components.engagement &&
      latest.recencyScore === result.components.recency &&
      latest.nextBestAction === result.nextBestAction &&
      JSON.stringify(latest.reasons) === JSON.stringify(result.reasons),
  );

  if (!sameSnapshot) {
    await tx.leadScoreHistory.create({
      data: {
        leadId,
        totalScore: result.total,
        fitScore: result.components.fit,
        intentScore: result.components.intent,
        engagementScore: result.components.engagement,
        recencyScore: result.components.recency,
        reasons: toInputJson(result.reasons),
        nextBestAction: result.nextBestAction,
      },
    });
  }

  await tx.lead.update({
    where: { id: leadId },
    data: {
      score: result.total,
      scoreBreakdown: toInputJson(breakdown),
      nextBestAction: result.nextBestAction,
      scoreCalculatedAt: now,
      nextScoreRefreshAt: result.nextRefreshAt,
      ...(shouldApplyAutomaticTemperature(lead.temperatureOverride)
        ? { temperature: result.temperature }
        : {}),
    },
  });

  return result;
}

export async function refreshDueLeadScores(
  where: Prisma.LeadWhereInput,
  now = new Date(),
) {
  let refreshed = 0;

  while (true) {
    const dueLeads = await prisma.lead.findMany({
      where: {
        AND: [
          where,
          {
            OR: [
              { scoreCalculatedAt: null },
              { nextScoreRefreshAt: { lte: now } },
            ],
          },
        ],
      },
      orderBy: { id: "asc" },
      take: 50,
      select: { id: true },
    });
    if (!dueLeads.length) break;

    for (const lead of dueLeads) {
      await prisma.$transaction((tx) =>
        recalculateLeadScore(tx, lead.id, now),
      );
      refreshed += 1;
    }
  }

  return refreshed;
}
