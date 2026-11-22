
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import {
  findLeadContactDuplicates,
  lockLeadContacts,
  normalizeLeadEmail,
  normalizeLeadPhone,
  recalculateLeadScore,
} from "@/lib/lead-crm";
import { checkPublicIntakeRateLimit } from "@/lib/rate-limit";
import { reportOperationalFailure } from "@/lib/observability";

export const dynamic = "force-dynamic";
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;

  return apiKey ? new Resend(apiKey) : null;
}

export async function POST(request: Request) {
  try {
    const rateLimit = await checkPublicIntakeRateLimit(request, "lead");
    if (rateLimit.unavailable) {
      return NextResponse.json(
        { success: false, message: "Enquiry intake is temporarily unavailable. Please try again shortly." },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }
    if (rateLimit.limited) {
      return NextResponse.json(
        { success: false, message: "Too many enquiries. Please try again later." },
        {
          status: 429,
          headers: {
            ...NO_STORE_HEADERS,
            "Retry-After": String(rateLimit.retryAfter),
          },
        },
      );
    }

    let body: Record<string, unknown>;

    try {
      const parsed: unknown = await request.json();

      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid request data." },
          { status: 400 },
        );
      }

      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request." },
        { status: 400 },
      );
    }

    const portfolioSlug = clean(body.portfolioSlug);
    const name = clean(body.name);
    const emailInput = clean(body.email);
    const phoneInput = clean(body.phone);
    const email = normalizeLeadEmail(emailInput);
    const phone = normalizeLeadPhone(phoneInput);
    const company = clean(body.company);
    const location = clean(body.location);
    const message = clean(body.message).slice(0, 5000);
    const interestedIn = clean(body.interestedIn).slice(0, 300);
    const budget = clean(body.budget).slice(0, 120);
    const timeline = clean(body.timeline).slice(0, 120);

    if (
      name.length > 120 || emailInput.length > 254 || phoneInput.length > 40 ||
      company.length > 160 || location.length > 160 ||
      clean(body.message).length > 5000 || clean(body.interestedIn).length > 300 ||
      clean(body.budget).length > 120 || clean(body.timeline).length > 120
    ) {
      return NextResponse.json(
        { success: false, message: "One or more enquiry fields are too long." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (!portfolioSlug) {
      return NextResponse.json(
        {
          success: false,
          message: "Portfolio identifier is required.",
        },
        { status: 400 },
      );
    }

    if (!name || name.length > 120) {
      return NextResponse.json(
        { success: false, message: "Name is required." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (!email && !phone) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide an email address or phone number.",
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (emailInput && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide a valid email address.",
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (phoneInput && !phone) {
      return NextResponse.json(
        { success: false, message: "Please provide a valid international phone number." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const portfolio = await prisma.portfolioSite.findUnique({
      where: { slug: portfolioSlug },
      select: {
        id: true,
        userId: true,
        published: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!portfolio || !portfolio.published) {
      return NextResponse.json(
        { success: false, message: "Portfolio is not available." },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    const intake = await prisma.$transaction(async (tx) => {
      await lockLeadContacts(tx, portfolio.id, email, phone);
      const duplicates = await findLeadContactDuplicates(tx, {
        portfolioId: portfolio.id,
        emailNormalized: email,
        phoneNormalized: phone,
      });
      if (duplicates.length > 1) return { kind: "REVIEW" as const };
      const match = duplicates[0];
      if (match && match.name.trim().toLowerCase() !== name.toLowerCase()) {
        return { kind: "REVIEW" as const };
      }

      let leadId = match?.id;
      if (!leadId) {
        const created = await tx.lead.create({
          data: {
            portfolioId: portfolio.id,
            ownerId: portfolio.userId,
            name,
            email,
            emailNormalized: email,
            phone,
            phoneNormalized: phone,
            company: company || null,
            location: location || null,
            message: message || null,
            source: "WEBSITE",
            origin: "WEBSITE_FORM",
            status: "NEW",
            temperature: "COLD",
            temperatureOverride: false,
            interestedIn: interestedIn || null,
            budget: budget || null,
            timeline: timeline || null,
          },
          select: { id: true },
        });
        leadId = created.id;
      } else {
        const existingLead = await tx.lead.findUnique({
          where: { id: leadId },
          select: { interestedIn: true, budget: true, timeline: true },
        });
        if (existingLead) {
          const qualification = {
            ...(interestedIn && !existingLead.interestedIn?.trim()
              ? { interestedIn }
              : {}),
            ...(budget && !existingLead.budget?.trim() ? { budget } : {}),
            ...(timeline && !existingLead.timeline?.trim() ? { timeline } : {}),
          };
          if (Object.keys(qualification).length) {
            await tx.lead.update({
              where: { id: leadId },
              data: qualification,
            });
          }
        }
      }

      await tx.leadActivity.create({
        data: {
          leadId,
          userId: portfolio.userId,
          type: "NOTE",
          title: match ? "Additional website enquiry received" : "New lead received from website",
          content:
            message || "Lead submitted through the professional website.",
          metadata: {
            source: "WEBSITE",
            origin: "WEBSITE_FORM",
            portfolioSlug,
            ...(interestedIn ? { interestedIn } : {}),
            ...(budget ? { budget } : {}),
            ...(timeline ? { timeline } : {}),
          },
        },
      });
      await recalculateLeadScore(tx, leadId);
      const lead = await tx.lead.findUnique({
        where: { id: leadId },
        select: { id: true, name: true, status: true, temperature: true, score: true },
      });
      return { kind: match ? "EXISTING" as const : "CREATED" as const, lead };
    });

    if (intake.kind === "REVIEW") {
      return NextResponse.json(
        {
          success: false,
          code: "CONTACT_REVIEW_REQUIRED",
          message: "We could not safely match these contact details. Please contact the portfolio owner to continue.",
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    const lead = intake.lead;
    if (!lead) {
      return NextResponse.json(
        { success: false, message: "Unable to confirm the lead record." },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }


    const isExistingLead = intake.kind === "EXISTING";

    const notificationTitle = isExistingLead
      ? "New enquiry from existing contact"
      : "New website lead";

    const notificationMessage = isExistingLead
      ? `${lead.name} submitted another enquiry through your website.`
      : `${lead.name} submitted a new enquiry through your website.`;

    const emailSubject = isExistingLead
      ? `New enquiry from existing contact: ${lead.name}`
      : `New website lead: ${lead.name}`;

    const emailHeading = isExistingLead
      ? "A returning contact has sent an enquiry"
      : "You have a new enquiry";

    const emailDescription = isExistingLead
      ? "An existing contact submitted another request through your professional website."
      : "A visitor submitted a request through your professional website.";

    // Save the in-app notification independently of email delivery.
    try {
      await prisma.notification.create({
        data: {
          userId: portfolio.userId,
          type: isExistingLead ? "SYSTEM" : "LEAD_CREATED",
          title: notificationTitle,
          message: notificationMessage,
          link: "/dashboard/leads",
          metadata: {
            leadId: lead.id,
            portfolioId: portfolio.id,
            portfolioSlug,
            source: "WEBSITE",
            temperature: lead.temperature,
            enquiryKind: intake.kind,
          },
        },
      });
    } catch (notificationError) {
      reportOperationalFailure("LEAD_NOTIFICATION_CREATE_FAILED", {
        cause: notificationError,
      });
    }

    // Email is best-effort and must never undo successful lead intake.
    try {
      const resend = getResendClient();
      const ownerEmail = portfolio.user.email;
      const fromEmail = process.env.RESEND_FROM_EMAIL;

      if (!resend || !ownerEmail || !fromEmail) {
        console.warn(
          "Lead email skipped: configure RESEND_API_KEY, RESEND_FROM_EMAIL, and the portfolio owner's email.",
        );
      } else {
        const safeName = escapeHtml(lead.name);
        const safeEmail = escapeHtml(email || "Not provided");
        const safePhone = escapeHtml(phone || "Not provided");
        const safeCompany = escapeHtml(company || "Not provided");
        const safeLocation = escapeHtml(location || "Not provided");
        const safeMessage = escapeHtml(message || "No message provided");
        const safeInterest = escapeHtml(interestedIn || "Not specified");
        const safeBudget = escapeHtml(budget || "Not specified");
        const safeTimeline = escapeHtml(timeline || "Not specified");
        const safeTemperature = escapeHtml(lead.temperature);
        const safeEmailHeading = escapeHtml(emailHeading);
        const safeEmailDescription = escapeHtml(emailDescription);

        const result = await resend.emails.send({
          from: fromEmail,
          to: [ownerEmail],
          subject: emailSubject,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#171923;line-height:1.6">
              <div style="padding:24px;background:#101116;color:#ffffff;border-radius:14px 14px 0 0">
                <p style="margin:0;color:#D9A441;font-size:12px;letter-spacing:2px;text-transform:uppercase">${isExistingLead ? "Existing contact enquiry" : "New lead notification"}</p>
                <h1 style="margin:10px 0 0;font-size:24px">${safeEmailHeading}</h1>
                <p style="margin:8px 0 0;color:#d1d5db">${safeEmailDescription}</p>
              </div>
              <div style="padding:24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 14px 14px">
                <p><strong>Name:</strong> ${safeName}</p>
                <p><strong>Email:</strong> ${safeEmail}</p>
                <p><strong>Phone:</strong> ${safePhone}</p>
                <p><strong>Company:</strong> ${safeCompany}</p>
                <p><strong>Location:</strong> ${safeLocation}</p>
                <p><strong>Interested in:</strong> ${safeInterest}</p>
                <p><strong>Budget:</strong> ${safeBudget}</p>
                <p><strong>Timeline:</strong> ${safeTimeline}</p>
                <p><strong>Lead temperature:</strong> ${safeTemperature}</p>
                <div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:10px">
                  <strong>Message</strong>
                  <p style="white-space:pre-wrap;margin-bottom:0">${safeMessage}</p>
                </div>
                <p style="margin-top:24px">
                  <a href="${escapeHtml(
                    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/leads`,
                  )}" style="display:inline-block;background:#D9A441;color:#17130B;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold">
                    View lead in dashboard
                  </a>
                </p>
              </div>
            </div>
          `,
          text: [
            emailHeading,
            "",
            emailDescription,
            "",
            `Name: ${lead.name}`,
            `Email: ${email || "Not provided"}`,
            `Phone: ${phone || "Not provided"}`,
            `Company: ${company || "Not provided"}`,
            `Location: ${location || "Not provided"}`,
            `Interested in: ${interestedIn || "Not specified"}`,
            `Budget: ${budget || "Not specified"}`,
            `Timeline: ${timeline || "Not specified"}`,
            `Lead temperature: ${lead.temperature}`,
            "",
            "Message:",
            message || "No message provided",
          ].join("\n"),
        });

        if (result.error) {
          reportOperationalFailure("LEAD_EMAIL_DELIVERY_FAILED", {
            cause: result.error,
          });
        }
      }
    } catch (emailError) {
      reportOperationalFailure("LEAD_EMAIL_DELIVERY_FAILED", {
        cause: emailError,
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Your request has been received successfully.",
      },
      { status: 201, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    reportOperationalFailure("PUBLIC_LEAD_INTAKE_FAILED", { cause: error });

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong while submitting your request.",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
