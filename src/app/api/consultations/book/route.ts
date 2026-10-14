import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { getAvailabilitySlots } from "@/lib/consultations/availability";

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

function getUtcDayRange(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);

  const startDate = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
  );

  const endDate = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );

  return { startDate, endDate };
}

export async function POST(request: Request) {
  try {
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
    const email = clean(body.email).toLowerCase();
    const phone = clean(body.phone);
    const reason = clean(body.reason);

    if (
      !portfolioSlug ||
      !consultationTypeId ||
      !scheduledAtValue ||
      !name ||
      !email ||
      !phone
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Please complete all required booking details.",
        },
        { status: 400 },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide a valid email address.",
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

    const consultationType = await prisma.consultationType.findFirst({
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
      return NextResponse.json(
        {
          success: false,
          message: "This consultation type is no longer available.",
        },
        { status: 404 },
      );
    }

    const timezone = "Africa/Nairobi";
    const dateKey = getDateKey(scheduledAt, timezone);
    const { startDate, endDate } = getUtcDayRange(dateKey);

    /*
     * All booking creation paths must acquire this same lock before
     * checking availability and creating a consultation.
     *
     * The lock is scoped to one portfolio and booking day. PostgreSQL
     * automatically releases the transaction-level lock at commit or
     * rollback.
     */
    const lockKey = portfolio.id;

    const booking = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
  SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text
`;

      /*
       * IMPORTANT:
       * Recheck availability AFTER acquiring the lock.
       *
       * If another request just booked this time, its transaction must
       * commit before this request obtains the same lock. The fresh
       * availability query can then see that booking and reject it.
       */
      const availableSlots = await getAvailabilitySlots({
        portfolioId: portfolio.id,
        consultationTypeId: consultationType.id,
        startDate,
        endDate,
      });

      const selectedSlot = availableSlots.find(
        (slot) => slot.start.getTime() === scheduledAt.getTime(),
      );

      if (!selectedSlot) {
        return null;
      }

      /*
       * Create the lead and consultation atomically.
       * If either creation fails, neither record is saved.
       */
      const lead = await tx.lead.create({
        data: {
          portfolioId: portfolio.id,
          ownerId: portfolio.userId,
          name,
          email,
          phone,
          message: reason || null,
          source: "WEBSITE",
          status: "NEW",
          temperature: "WARM",
          score: 40,
          interestedIn: consultationType.title,
          activities: {
            create: {
              userId: portfolio.userId,
              type: "NOTE",
              title: "Consultation booking request received",
              content:
                reason ||
                `Requested a ${consultationType.title} consultation.`,
              metadata: {
                source: "PUBLIC_CONSULTATION_BOOKING",
                portfolioSlug,
              },
            },
          },
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


return { lead, consultation };
    }, {
      maxWait: 10000,
      timeout: 15000,
    });

    if (!booking) {
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

    // Notification failures must never undo a successfully saved booking.
    try {
      await prisma.notification.create({
        data: {
          userId: portfolio.userId,
          type: "CONSULTATION_REQUESTED",
          title: "New consultation request",
          message: `${name} requested ${consultationType.title}.`,
          link: "/dashboard/consultations",
          metadata: {
            leadId: booking.lead.id,
            consultationId: booking.consultation.id,
            portfolioId: portfolio.id,
            portfolioSlug,
            scheduledAt: booking.consultation.scheduledAt.toISOString(),
          },
        },
      });
    } catch (error) {
      console.error(
        "Booking saved, but in-app notification failed:",
        error,
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
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        ).replace(/\/+$/, "");

        const dashboardUrl = `${appUrl}/dashboard/consultations`;

        const result = await resend.emails.send({
          from: fromEmail,
          to: [ownerEmail],
          subject: `New consultation request: ${booking.consultation.title}`,
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
          console.error(
            "Resend rejected the consultation email:",
            result.error,
          );
        }
      } else {
        console.warn(
          "Consultation email skipped: email configuration is incomplete.",
        );
      }
    } catch (error) {
      console.error(
        "Booking saved, but email notification failed:",
        error,
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
          scheduledAt: booking.consultation.scheduledAt.toISOString(),
          timezone: booking.consultation.timezone,
          durationMinutes: booking.consultation.durationMinutes,
        },
      },
      { status: 201 },
    );
  } catch (error) {
   console.error("Public consultation booking error:", {
  message: error instanceof Error ? error.message : String(error),
  stack: error instanceof Error ? error.stack : undefined,
  cause: error instanceof Error ? error.cause : undefined,
});

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