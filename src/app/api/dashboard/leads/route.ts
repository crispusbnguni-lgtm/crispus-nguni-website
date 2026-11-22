import { LeadSource, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  findLeadContactDuplicates,
  lockLeadContacts,
  normalizeLeadEmail,
  normalizeLeadPhone,
  recalculateLeadScore,
} from "@/lib/lead-crm";
import { checkLeadCreationRateLimit } from "@/lib/rate-limit";
import { requireSameOriginApiRequest } from "@/lib/authorization";

export const dynamic = "force-dynamic";

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function duplicateResponse(leads: unknown[]) {
  return NextResponse.json(
    {
      success: false,
      code: "LEAD_DUPLICATE",
      message: "A lead with this phone number or email already exists. Review the matching record before continuing.",
      leads,
    },
    { status: 409, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const originResponse = requireSameOriginApiRequest(request);
  if (originResponse) return originResponse;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, message: "Authentication required." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const rate = await checkLeadCreationRateLimit(request, user.id);
  if (rate.unavailable) {
    return NextResponse.json(
      { success: false, message: "Lead creation is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (rate.limited) {
    return NextResponse.json(
      { success: false, message: "Too many lead creation attempts. Please try again later." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(rate.retryAfter),
        },
      },
    );
  }

  let body: Record<string, unknown>;
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    body = value as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON request." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const name = text(body.name, 120);
  const emailInput = text(body.email, 254);
  const phoneInput = text(body.phone, 40);
  const company = text(body.company, 160);
  const location = text(body.location, 160);
  const interestedIn = text(body.interestedIn, 300);
  const budget = text(body.budget, 120);
  const timeline = text(body.timeline, 120);
  const notes = text(body.notes, 5000);
  const sourceDetail = text(body.sourceDetail, 200);
  const emailNormalized = normalizeLeadEmail(emailInput);
  const phoneNormalized = normalizeLeadPhone(phoneInput);
  const source = typeof body.source === "string" ? body.source : "";

  if (!name) {
    return NextResponse.json(
      { success: false, message: "Name is required." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!emailInput && !phoneInput) {
    return NextResponse.json(
      { success: false, message: "Provide at least one contact method: phone or email." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (emailInput && (!emailNormalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized))) {
    return NextResponse.json(
      { success: false, message: "Enter a valid email address." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (phoneInput && !phoneNormalized) {
    return NextResponse.json(
      { success: false, message: "Enter a valid international phone number, including its country code." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!Object.values(LeadSource).includes(source as LeadSource)) {
    return NextResponse.json(
      { success: false, message: "Select a valid acquisition source." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (
    body.decisionMaker !== undefined &&
    body.decisionMaker !== null &&
    typeof body.decisionMaker !== "boolean"
  ) {
    return NextResponse.json(
      { success: false, message: "Decision-maker status must be yes, no, or not specified." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const nextFollowUpAt =
    body.nextFollowUpAt === undefined || body.nextFollowUpAt === null || body.nextFollowUpAt === ""
      ? null
      : typeof body.nextFollowUpAt === "string" &&
          !Number.isNaN(Date.parse(body.nextFollowUpAt))
        ? new Date(body.nextFollowUpAt)
        : undefined;
  if (nextFollowUpAt === undefined) {
    return NextResponse.json(
      { success: false, message: "Enter a valid follow-up date and time." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // A normal user can only add records to their own personal portfolio.
  // Super admins also default to their own portfolio; this endpoint never
  // accepts a client-selected owner or portfolio.
  const portfolio = await prisma.portfolioSite.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!portfolio) {
    return NextResponse.json(
      { success: false, message: "Your portfolio is not available for lead creation." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockLeadContacts(tx, portfolio.id, emailNormalized, phoneNormalized);
      const duplicates = await findLeadContactDuplicates(tx, {
        portfolioId: portfolio.id,
        emailNormalized,
        phoneNormalized,
      });
      if (duplicates.length) return { kind: "DUPLICATE" as const, duplicates };

      const lead = await tx.lead.create({
        data: {
          portfolioId: portfolio.id,
          ownerId: user.id,
          createdById: user.id,
          name,
          email: emailNormalized,
          emailNormalized,
          phone: phoneNormalized,
          phoneNormalized,
          company,
          location,
          interestedIn,
          budget,
          timeline,
          decisionMaker: (body.decisionMaker as boolean | null | undefined) ?? null,
          source: source as LeadSource,
          sourceDetail,
          origin: "MANUAL_ENTRY",
          status: "NEW",
          temperature: "COLD",
          temperatureOverride: false,
          nextFollowUpAt,
        },
        select: { id: true },
      });

      const createdAt = new Date();
      await tx.leadActivity.create({
        data: {
          leadId: lead.id,
          userId: user.id,
          type: "NOTE",
          title: "Lead added manually",
          content: notes,
          metadata: {
            origin: "MANUAL_ENTRY",
            source: source as string,
            ...(sourceDetail ? { sourceDetail } : {}),
          },
          createdAt,
        },
      });
      if (nextFollowUpAt) {
        await tx.leadActivity.create({
          data: {
            leadId: lead.id,
            userId: user.id,
            type: "FOLLOW_UP",
            title: "Follow-up scheduled",
            content: `Follow-up scheduled for ${nextFollowUpAt.toISOString()}.`,
            metadata: { nextFollowUpAt: nextFollowUpAt.toISOString() },
            createdAt,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "LEAD_CREATED",
          targetType: "Lead",
          targetId: lead.id,
          metadata: { portfolioId: portfolio.id, origin: "MANUAL_ENTRY" },
          createdAt,
        },
      });

      await recalculateLeadScore(tx, lead.id, createdAt);
      const created = await tx.lead.findUnique({
        where: { id: lead.id },
        include: {
          scoreHistory: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
          },
        },
      });
      return { kind: "CREATED" as const, lead: created };
    });

    if (result.kind === "DUPLICATE") return duplicateResponse(result.duplicates);

    return NextResponse.json(
      { success: true, lead: result.lead },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const duplicates = await prisma.$transaction((tx) =>
        findLeadContactDuplicates(tx, {
          portfolioId: portfolio.id,
          emailNormalized,
          phoneNormalized,
        }),
      );
      if (duplicates.length) return duplicateResponse(duplicates);
    }
    console.error("POST /api/dashboard/leads failed:", error);
    return NextResponse.json(
      { success: false, message: "Unable to create this lead right now." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
