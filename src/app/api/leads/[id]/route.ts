import { NextResponse } from "next/server";
import {
  LeadActivityType,
  LeadStatus,
  LeadTemperature,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  findLeadContactDuplicates,
  lockLeadContacts,
  normalizeLeadEmail,
  normalizeLeadPhone,
  recalculateLeadScore,
} from "@/lib/lead-crm";
import { leadPortfolioScope } from "@/lib/lead-access";
import { requireSameOriginApiRequest } from "@/lib/authorization";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "DISQUALIFIED",
  "CONVERTED",
  "LOST",
] as const;

const TEMPERATURES = ["HOT", "WARM", "COLD", "DORMANT"] as const;

const ACTIVITY_TYPES = [
  "NOTE",
  "CALL",
  "EMAIL",
  "WHATSAPP",
  "MEETING",
  "FOLLOW_UP",
] as const satisfies readonly LeadActivityType[];

function clean(value: unknown, maxLength = 2000): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function isValidDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !Number.isNaN(Date.parse(value))
  );
}

async function parseBody(request: Request) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { data: null, error: "Invalid request body." };
    }

    return {
      data: body as Record<string, unknown>,
      error: null,
    };
  } catch {
    return { data: null, error: "Invalid JSON request body." };
  }
}

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 },
      );
    }

    const { id } = await params;

    const access = leadPortfolioScope(user);
    const scoreState = await prisma.lead.findFirst({
      where: { id, ...access },
      select: { id: true, scoreCalculatedAt: true, nextScoreRefreshAt: true },
    });

    if (!scoreState) {
      return NextResponse.json(
        { success: false, message: "Lead not found." },
        { status: 404 },
      );
    }

    const now = new Date();
    if (
      !scoreState.scoreCalculatedAt ||
      (scoreState.nextScoreRefreshAt && scoreState.nextScoreRefreshAt <= now)
    ) {
      await prisma.$transaction((tx) => recalculateLeadScore(tx, id, now));
    }

    const lead = await prisma.lead.findFirst({
      where: {
        id,
        ...access,
      },
      include: {
        portfolio: {
  select: {
    id: true,
    name: true,
    slug: true,
    user: {
      select: {
        id: true,
        name: true,
        email: true,
        portfolioSite: {
          select: {
            theme: true,
            dashboardBackground: true,
          },
        },
      },
    },
  },
},
        activities: {
          orderBy: { createdAt: "desc" },
          take: 100,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        consultations: {
          orderBy: { scheduledAt: "desc" },
          take: 50,
          include: {
            consultationType: true,
          },
        },
        scoreHistory: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 20,
        },
      },
    });

    if (!lead) {
      return NextResponse.json(
        { success: false, message: "Lead not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, lead });
  } catch (error) {
    console.error("GET /api/leads/[id] failed:", error);

    return NextResponse.json(
      { success: false, message: "Unable to retrieve this lead." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  try {
    const originResponse = requireSameOriginApiRequest(request);
    if (originResponse) return originResponse;

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 },
      );
    }

    const { id } = await params;
    const { data, error } = await parseBody(request);

    if (error || !data) {
      return NextResponse.json(
        { success: false, message: error },
        { status: 400 },
      );
    }

    const existingLead = await prisma.lead.findFirst({
      where: {
        id,
        ...leadPortfolioScope(user),
      },
      select: {
        id: true,
        portfolioId: true,
        email: true,
        emailNormalized: true,
        phone: true,
        phoneNormalized: true,
        status: true,
        temperature: true,
        temperatureOverride: true,
        nextFollowUpAt: true,
      },
    });

    if (!existingLead) {
      return NextResponse.json(
        { success: false, message: "Lead not found." },
        { status: 404 },
      );
    }

    const updateData: {
      name?: string;
      email?: string | null;
      emailNormalized?: string | null;
      phone?: string | null;
      phoneNormalized?: string | null;
      company?: string | null;
      location?: string | null;
      message?: string | null;
      interestedIn?: string | null;
      budget?: string | null;
      timeline?: string | null;
      decisionMaker?: boolean | null;
      status?: LeadStatus;
      temperature?: LeadTemperature;
      temperatureOverride?: boolean;
      nextFollowUpAt?: Date | null;
      convertedAt?: Date | null;
      lostAt?: Date | null;
    } = {};

    const activities: {
      type: LeadActivityType;
      title: string;
      content: string | null;
      metadata?: Record<string, string | null>;
    }[] = [];

    if ("name" in data) {
      const name = clean(data.name, 120);

      if (!name) {
        return NextResponse.json(
          { success: false, message: "Lead name cannot be empty." },
          { status: 400 },
        );
      }

      updateData.name = name;
    }

    if ("email" in data) {
      const email = clean(data.email, 254);
      const normalizedEmail = normalizeLeadEmail(email);

      if (email && (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))) {
        return NextResponse.json(
          { success: false, message: "Enter a valid email address." },
          { status: 400 },
        );
      }

      updateData.email = normalizedEmail;
      updateData.emailNormalized = normalizedEmail;
    }

    if ("phone" in data) {
      const phone = clean(data.phone, 40);
      const normalizedPhone = normalizeLeadPhone(phone);
      if (phone && !normalizedPhone) {
        return NextResponse.json(
          { success: false, message: "Enter a valid international phone number, including its country code." },
          { status: 400 },
        );
      }
      updateData.phone = normalizedPhone;
      updateData.phoneNormalized = normalizedPhone;
    }

    if ("company" in data) {
      updateData.company = clean(data.company, 160);
    }

    if ("location" in data) {
      updateData.location = clean(data.location, 160);
    }

    if ("message" in data) {
      updateData.message = clean(data.message, 5000);
    }

    if ("interestedIn" in data) {
      updateData.interestedIn = clean(data.interestedIn, 300);
    }

    if ("budget" in data) {
      updateData.budget = clean(data.budget, 120);
    }

    if ("timeline" in data) {
      updateData.timeline = clean(data.timeline, 120);
    }

    if ("decisionMaker" in data) {
      if (
        data.decisionMaker !== null &&
        typeof data.decisionMaker !== "boolean"
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Decision-maker value must be true, false, or null.",
          },
          { status: 400 },
        );
      }

      updateData.decisionMaker = data.decisionMaker as boolean | null;
    }

    if ("status" in data) {
      if (
        typeof data.status !== "string" ||
        !STATUSES.includes(data.status as (typeof STATUSES)[number])
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid lead status." },
          { status: 400 },
        );
      }

      const nextStatus = data.status as LeadStatus;

      if (nextStatus !== existingLead.status) {
        updateData.status = nextStatus;

        if (nextStatus === "CONVERTED") {
          updateData.convertedAt = new Date();
          updateData.lostAt = null;
        } else if (nextStatus === "LOST") {
          updateData.lostAt = new Date();
          updateData.convertedAt = null;
        } else {
          updateData.convertedAt = null;
          updateData.lostAt = null;
        }

        activities.push({
          type: "STATUS_CHANGE",
          title: `Status changed to ${nextStatus
            .replace(/_/g, " ")
            .toLowerCase()}`,
          content: `Previous status: ${existingLead.status}. New status: ${nextStatus}.`,
          metadata: {
            previousStatus: existingLead.status,
            newStatus: nextStatus,
          },
        });
      }
    }

    if ("temperature" in data) {
      if (
        typeof data.temperature !== "string" ||
        !TEMPERATURES.includes(
          data.temperature as (typeof TEMPERATURES)[number],
        )
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid lead temperature." },
          { status: 400 },
        );
      }

      const nextTemperature = data.temperature as LeadTemperature;

      if (nextTemperature !== existingLead.temperature) {
        updateData.temperature = nextTemperature;
        updateData.temperatureOverride = true;

        activities.push({
          type: "TEMPERATURE_CHANGE",
          title: `Temperature changed to ${nextTemperature.toLowerCase()}`,
          content: `Previous temperature: ${existingLead.temperature}. New temperature: ${nextTemperature}.`,
          metadata: {
            previousTemperature: existingLead.temperature,
            newTemperature: nextTemperature,
          },
        });
      }
    }

    if ("nextFollowUpAt" in data) {
      if (data.nextFollowUpAt === null || data.nextFollowUpAt === "") {
        updateData.nextFollowUpAt = null;
      } else if (isValidDate(data.nextFollowUpAt)) {
        updateData.nextFollowUpAt = new Date(data.nextFollowUpAt);
      } else {
        return NextResponse.json(
          {
            success: false,
            message: "Enter a valid follow-up date and time.",
          },
          { status: 400 },
        );
      }

      const nextFollowUpAt = updateData.nextFollowUpAt ?? null;

      if (
        nextFollowUpAt?.getTime() !==
        (existingLead.nextFollowUpAt?.getTime() ?? null)
      ) {
        activities.push({
          type: "FOLLOW_UP",
          title: nextFollowUpAt
            ? "Follow-up scheduled"
            : "Follow-up removed",
          content: nextFollowUpAt
            ? `Follow-up scheduled for ${nextFollowUpAt.toISOString()}.`
            : "The scheduled follow-up was removed.",
          metadata: {
            nextFollowUpAt: nextFollowUpAt?.toISOString() ?? null,
          },
        });
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, message: "No valid changes were provided." },
        { status: 400 },
      );
    }

    const leadResult = await prisma.$transaction(async (tx) => {
      const contactChanged =
        updateData.emailNormalized !== undefined ||
        updateData.phoneNormalized !== undefined;
      if (contactChanged) {
        const resultingEmail =
          updateData.emailNormalized !== undefined
            ? updateData.emailNormalized
            : existingLead.emailNormalized ?? normalizeLeadEmail(existingLead.email);
        const resultingPhone =
          updateData.phoneNormalized !== undefined
            ? updateData.phoneNormalized
            : existingLead.phoneNormalized ?? normalizeLeadPhone(existingLead.phone);

        await lockLeadContacts(tx, existingLead.portfolioId, resultingEmail, resultingPhone);
        const duplicates = await findLeadContactDuplicates(tx, {
          portfolioId: existingLead.portfolioId,
          emailNormalized: resultingEmail,
          phoneNormalized: resultingPhone,
          excludeLeadId: existingLead.id,
        });
        if (duplicates.length) return { kind: "DUPLICATE" as const, duplicates };
      }

      await tx.lead.update({
        where: { id: existingLead.id },
        data: {
          ...updateData,
          ...(activities.length > 0
            ? {
                activities: {
                  create: activities.map((activity) => ({
                    userId: user.id,
                    type: activity.type,
                    title: activity.title,
                    content: activity.content,
                    ...(activity.metadata
                      ? { metadata: activity.metadata }
                      : {}),
                  })),
                },
              }
            : {}),
        },
      });
      await recalculateLeadScore(tx, existingLead.id);
      const lead = await tx.lead.findUnique({
        where: { id: existingLead.id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          company: true,
          location: true,
          message: true,
          interestedIn: true,
          budget: true,
          timeline: true,
          decisionMaker: true,
          status: true,
          temperature: true,
          score: true,
          nextFollowUpAt: true,
          lastContactedAt: true,
          convertedAt: true,
          lostAt: true,
          updatedAt: true,
          scoreBreakdown: true,
          nextBestAction: true,
          scoreHistory: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
          },
        },
      });
      return { kind: "UPDATED" as const, lead };
    });

    if (leadResult.kind === "DUPLICATE") {
      return NextResponse.json(
        {
          success: false,
          code: "LEAD_DUPLICATE",
          message: "A lead with this phone number or email already exists.",
          leads: leadResult.duplicates,
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Lead updated successfully.",
      lead: leadResult.lead,
    });
  } catch (error) {
    console.error("PATCH /api/leads/[id] failed:", error);

    return NextResponse.json(
      { success: false, message: "Unable to update this lead." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: RouteContext,
) {
  try {
    const originResponse = requireSameOriginApiRequest(request);
    if (originResponse) return originResponse;

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 },
      );
    }

    const { id } = await params;
    const { data, error } = await parseBody(request);

    if (error || !data) {
      return NextResponse.json(
        { success: false, message: error },
        { status: 400 },
      );
    }

    if (
      typeof data.type !== "string" ||
      !ACTIVITY_TYPES.includes(data.type as (typeof ACTIVITY_TYPES)[number])
    ) {
      return NextResponse.json(
        { success: false, message: "Select a valid activity type." },
        { status: 400 },
      );
    }

    const type = data.type as LeadActivityType;
    const title = clean(data.title, 160);
    const content = clean(data.content, 5000);
    const consultationId = clean(data.consultationId, 100);

    if (!title) {
      return NextResponse.json(
        { success: false, message: "Activity title is required." },
        { status: 400 },
      );
    }

    if (data.nextFollowUpAt !== undefined) {
      if (
        data.nextFollowUpAt !== null &&
        data.nextFollowUpAt !== "" &&
        !isValidDate(data.nextFollowUpAt)
      ) {
        return NextResponse.json(
          { success: false, message: "Enter a valid follow-up date and time." },
          { status: 400 },
        );
      }
    }

    const lead = await prisma.lead.findFirst({
      where: {
        id,
        ...leadPortfolioScope(user),
      },
      select: {
        id: true,
        nextFollowUpAt: true,
      },
    });

    if (!lead) {
      return NextResponse.json(
        { success: false, message: "Lead not found." },
        { status: 404 },
      );
    }

    const isContactActivity = [
      "CALL",
      "EMAIL",
      "WHATSAPP",
      "MEETING",
    ].includes(type);

    const nextFollowUpAt =
      data.nextFollowUpAt === undefined
        ? undefined
        : data.nextFollowUpAt === null || data.nextFollowUpAt === ""
          ? null
          : new Date(data.nextFollowUpAt as string);

    const metadata: Prisma.InputJsonObject = {
      ...(data.outcome !== undefined && clean(data.outcome, 300)
        ? { outcome: clean(data.outcome, 300)! }
        : {}),
      ...(data.channel !== undefined && clean(data.channel, 100)
        ? { channel: clean(data.channel, 100)! }
        : {}),
      ...(consultationId ? { consultationId } : {}),
    };

    if (consultationId && type !== "MEETING") {
      return NextResponse.json(
        { success: false, message: "A consultation can only be linked to a meeting activity." },
        { status: 400 },
      );
    }

    const activityResult = await prisma.$transaction(async (tx) => {
      if (consultationId) {
        const linkedConsultation = await tx.consultation.findFirst({
          where: { id: consultationId, leadId: lead.id },
          select: { id: true },
        });
        if (!linkedConsultation) return { kind: "INVALID_CONSULTATION" as const };
      }

      const activity = await tx.leadActivity.create({
        data: {
          leadId: lead.id,
          userId: user.id,
          type,
          title,
          content,
          ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      await tx.lead.update({
        where: { id: lead.id },
        data: {
          ...(isContactActivity ? { lastContactedAt: new Date() } : {}),
          ...(nextFollowUpAt !== undefined
            ? { nextFollowUpAt }
            : {}),
        },
      });

      await recalculateLeadScore(tx, lead.id);
      return { kind: "CREATED" as const, activity };
    });

    if (activityResult.kind === "INVALID_CONSULTATION") {
      return NextResponse.json(
        { success: false, message: "The linked consultation was not found for this lead." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Activity recorded successfully.",
        activity: activityResult.activity,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/leads/[id] failed:", error);

    return NextResponse.json(
      { success: false, message: "Unable to record this activity." },
      { status: 500 },
    );
  }
}
