
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import {
  getAvailabilitySlots,
  getZonedDayRange,
  isValidIanaTimezone,
} from "@/lib/consultations/availability";
import {
  findLeadContactDuplicates,
  lockLeadContacts,
  normalizeLeadEmail,
  normalizeLeadPhone,
  recalculateLeadScore,
} from "@/lib/lead-crm";
import { checkPublicIntakeRateLimit } from "@/lib/rate-limit";
import { reportOperationalFailure } from "@/lib/observability";

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

function getDateKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return `${values.year}-${values.month}-${values.day}`;
}

export async function POST(request: Request) {
  try {
    const rateLimit = await checkPublicIntakeRateLimit(
      request,
      "consultation",
    );

    if (rateLimit.unavailable) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Booking is temporarily unavailable. Please try again shortly.",
        },
        {
          status: 503,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    if (rateLimit.limited) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Too many booking requests. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
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
    const consultationTypeId = clean(body.consultationTypeId);
    const scheduledAtValue = clean(body.scheduledAt);
    const name = clean(body.fullName);
    const emailInput = clean(body.email);
    const phoneInput = clean(body.phone);
    const email = normalizeLeadEmail(emailInput);
    const phone = normalizeLeadPhone(phoneInput);
    const reason = clean(body.reason);

    if (
      !portfolioSlug ||
      !consultationTypeId ||
      !scheduledAtValue ||
      !name ||
      !emailInput ||
      !phoneInput
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Please complete all required booking details.",
        },
        { status: 400 },
      );
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide a valid email address.",
        },
        { status: 400 },
      );
    }

    if (!phone) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide a valid international phone number.",
        },
        { status: 400 },
      );
    }

    if (name.length > 120 || email.length > 254 || phone.length > 40) {
      return NextResponse.json(
        {
          success: false,
          message: "One or more contact details are too long.",
        },
        { status: 400 },
      );
    }

    if (reason.length > 3000) {
      return NextResponse.json(
        {
          success: false,
          message: "Please shorten the consultation message.",
        },
        { status: 400 },
      );
    }

    const scheduledAt = new Date(scheduledAtValue);

    if (
      Number.isNaN(scheduledAt.getTime()) ||
      !/^\d{4}-\d{2}-\d{2}T/.test(scheduledAtValue)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "The selected consultation time is invalid.",
        },
        { status: 400 },
      );
    }

    const portfolio = await prisma.portfolioSite.findUnique({
      where: { slug: portfolioSlug },
      select: {
        id: true,
        userId: true,
        published: true,
        timezone: true,
        timezoneReviewRequired: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!portfolio || !portfolio.published) {
      return NextResponse.json(
        {
          success: false,
          message: "This portfolio is not available for booking.",
        },
        { status: 404 },
      );
    }

    if (
      portfolio.timezoneReviewRequired ||
      !isValidIanaTimezone(portfolio.timezone)
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "TIMEZONE_REVIEW_REQUIRED",
          message:
            "The portfolio owner must review the booking timezone before appointments can be requested.",
        },
        { status: 409 },
      );
    }

    const timezone = portfolio.timezone;
    const dateKey = getDateKey(scheduledAt, timezone);
    const { startDate, endDate } = getZonedDayRange(
      dateKey,
      timezone,
    );

    /*
     * All booking creation and availability configuration mutation
     * paths must acquire this same portfolio advisory lock.
     *
     * This serializes booking decisions against other booking and
     * availability changes for this portfolio.
     */
    const lockKey = portfolio.id;

    const booking = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
  SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
`;

        /*
         * Re-fetch the consultation type only after acquiring the lock.
         *
         * This ensures a concurrently deactivated or modified type
         * cannot be used through stale pre-transaction data.
         */
        const consultationType =
          await tx.consultationType.findFirst({
            where: {
              id: consultationTypeId,
              portfolioId: portfolio.id,
              active: true,
            },
            select: {
              id: true,
              title: true,
              durationMinutes: true,
              meetingMethod: true,
            },
          });

        if (!consultationType) {
          return { kind: "TYPE_UNAVAILABLE" as const };
        }

        /*
         * Recheck availability after acquiring the lock.
         * The transaction client ensures the availability query
         * participates in the same transaction.
         */
        const availableSlots = await getAvailabilitySlots({
          portfolioId: portfolio.id,
          consultationTypeId: consultationType.id,
          startDate,
          endDate,
          client: tx,
        });

        const selectedSlot = availableSlots.find(
          (slot) =>
            slot.start.getTime() === scheduledAt.getTime(),
        );

        if (!selectedSlot) {
          return { kind: "SLOT_UNAVAILABLE" as const };
        }

        await lockLeadContacts(tx, portfolio.id, email, phone);

        const duplicates = await findLeadContactDuplicates(tx, {
          portfolioId: portfolio.id,
          emailNormalized: email,
          phoneNormalized: phone,
        });

        if (duplicates.length > 1) {
          return { kind: "DUPLICATE_REVIEW" as const };
        }

        const matchingLead = duplicates[0];

        if (
          matchingLead &&
          matchingLead.name.trim().toLocaleLowerCase() !==
            name.toLocaleLowerCase()
        ) {
          return { kind: "DUPLICATE_REVIEW" as const };
        }

        /*
         * Create a lead only when this portfolio has no matching
         * contact. Existing records are not overwritten.
         */
        const lead = matchingLead
          ? {
              id: matchingLead.id,
              name: matchingLead.name,
            }
          : await tx.lead.create({
              data: {
                portfolioId: portfolio.id,
                ownerId: portfolio.userId,
                name,
                email,
                emailNormalized: email,
                phone,
                phoneNormalized: phone,
                message: reason || null,
                source: "WEBSITE",
                origin: "PUBLIC_CONSULTATION",
                status: "NEW",
                temperature: "COLD",
                temperatureOverride: false,
                interestedIn: consultationType.title,
              },
              select: {
                id: true,
                name: true,
              },
            });

        const consultation = await tx.consultation.create({
          data: {
            portfolioId: portfolio.id,
            leadId: lead.id,
            ownerId: portfolio.userId,
            consultationTypeId: consultationType.id,
            title: consultationType.title,
            status: "PENDING",
            scheduledAt: selectedSlot.start,
            durationMinutes: consultationType.durationMinutes,
            timezone: selectedSlot.timezone,
            meetingMethod: consultationType.meetingMethod,
          },
          select: {
            id: true,
            title: true,
            status: true,
            scheduledAt: true,
            timezone: true,
            durationMinutes: true,
          },
        });

        await tx.leadActivity.create({
          data: {
            leadId: lead.id,
            userId: portfolio.userId,
            type: "NOTE",
            title: matchingLead
              ? "Additional consultation requested"
              : "Consultation booking request received",
            content:
              reason ||
              `Requested a ${consultationType.title} consultation.`,
            metadata: {
              source: "PUBLIC_CONSULTATION_BOOKING",
              portfolioSlug,
              consultationId: consultation.id,
            },
          },
        });

        await tx.consultationActivity.create({
          data: {
            consultationId: consultation.id,
            userId: portfolio.userId,
            title: "Public consultation request submitted",
            content:
              "The visitor submitted a consultation request through the public portfolio.",
            metadata: {
              source: "PUBLIC_CONSULTATION_BOOKING",
              portfolioSlug,
            },
          },
        });

        await recalculateLeadScore(tx, lead.id);

        return {
          kind: "BOOKED" as const,
          lead,
          consultation,
        };
      },
      {
        maxWait: 10000,
        timeout: 15000,
      },
    );

    if (booking.kind === "TYPE_UNAVAILABLE") {
      return NextResponse.json(
        {
          success: false,
          message: "This consultation type is no longer available.",
        },
        {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    if (booking.kind === "DUPLICATE_REVIEW") {
      return NextResponse.json(
        {
          success: false,
          message:
            "We could not safely match these contact details. Please contact the portfolio owner to continue.",
          code: "CONTACT_REVIEW_REQUIRED",
        },
        {
          status: 409,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    if (booking.kind === "SLOT_UNAVAILABLE") {
      return NextResponse.json(
        {
          success: false,
          message:
            "That time is no longer available. Please choose another time.",
          code: "SLOT_UNAVAILABLE",
        },
        { status: 409 },
      );
    }

    if (booking.kind !== "BOOKED") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unable to complete this consultation request.",
        },
        { status: 500 },
      );
    }

    // Notification failures must never undo a successfully saved booking.
    try {
      await prisma.notification.create({
        data: {
          userId: portfolio.userId,
          type: "CONSULTATION_REQUESTED",
          title: "New consultation request",
          message: `${name} requested ${booking.consultation.title}.`,
          link: "/dashboard/consultations",
          metadata: {
            leadId: booking.lead.id,
            consultationId: booking.consultation.id,
            portfolioId: portfolio.id,
            portfolioSlug,
            scheduledAt:
              booking.consultation.scheduledAt.toISOString(),
          },
        },
      });
    } catch (error) {
      reportOperationalFailure(
        "CONSULTATION_NOTIFICATION_CREATE_FAILED",
        { cause: error },
      );
    }

    // Email is best-effort; delivery failure must not undo a booking.
    try {
      const apiKey = process.env.RESEND_API_KEY;
      const fromEmail = process.env.RESEND_FROM_EMAIL;
      const ownerEmail = portfolio.user.email;

      if (apiKey && fromEmail && ownerEmail) {
        const resend = new Resend(apiKey);

        const formattedDate = new Intl.DateTimeFormat("en-KE", {
          dateStyle: "full",
          timeStyle: "short",
          timeZone: booking.consultation.timezone,
        }).format(booking.consultation.scheduledAt);

        const safeName = escapeHtml(name);
        const safeEmail = escapeHtml(email);
        const safePhone = escapeHtml(phone);
        const safeTitle = escapeHtml(booking.consultation.title);
        const safeDate = escapeHtml(formattedDate);
        const safeReason = escapeHtml(
          reason || "No additional message provided",
        );

        const appUrl = (
          process.env.NEXT_PUBLIC_APP_URL ||
          "http://localhost:3000"
        ).replace(/\/+$/, "");

        const dashboardUrl =
          `${appUrl}/dashboard/consultations`;

        const result = await resend.emails.send({
          from: fromEmail,
          to: [ownerEmail],
          subject:
            `New consultation request: ${booking.consultation.title}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#171923;line-height:1.6">
              <h2>New consultation request</h2>
              <p><strong>Name:</strong> ${safeName}</p>
              <p><strong>Email:</strong> ${safeEmail}</p>
              <p><strong>Phone:</strong> ${safePhone}</p>
              <p><strong>Consultation:</strong> ${safeTitle}</p>
              <p><strong>Requested time:</strong> ${safeDate}</p>
              <p><strong>Message:</strong></p>
              <p style="white-space:pre-wrap">${safeReason}</p>
              <p>
                <a href="${escapeHtml(dashboardUrl)}">
                  Open consultations dashboard
                </a>
              </p>
            </div>
          `,
          text: [
            "New consultation request",
            `Name: ${name}`,
            `Email: ${email}`,
            `Phone: ${phone}`,
            `Consultation: ${booking.consultation.title}`,
            `Requested time: ${formattedDate}`,
            `Message: ${reason || "No additional message provided"}`,
          ].join("\n"),
        });

        if (result.error) {
          reportOperationalFailure(
            "CONSULTATION_EMAIL_DELIVERY_FAILED",
            { cause: result.error },
          );
        }
      } else {
        console.warn(
          "Consultation email skipped: email configuration is incomplete.",
        );
      }
    } catch (error) {
      reportOperationalFailure(
        "CONSULTATION_EMAIL_DELIVERY_FAILED",
        { cause: error },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Your consultation request has been submitted.",
        booking: {
          id: booking.consultation.id,
          title: booking.consultation.title,
          status: booking.consultation.status,
          scheduledAt:
            booking.consultation.scheduledAt.toISOString(),
          timezone: booking.consultation.timezone,
          durationMinutes: booking.consultation.durationMinutes,
        },
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    reportOperationalFailure(
      "PUBLIC_CONSULTATION_BOOKING_FAILED",
      { cause: error },
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "We couldn't submit your consultation request. Please try again.",
      },
      { status: 500 },
    );
  }
}
