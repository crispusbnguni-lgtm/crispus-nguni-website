
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

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
    const email = clean(body.email);
    const phone = clean(body.phone);
    const company = clean(body.company);
    const location = clean(body.location);
    const message = clean(body.message);
    const interestedIn = clean(body.interestedIn);
    const budget = clean(body.budget);
    const timeline = clean(body.timeline);

    if (!portfolioSlug) {
      return NextResponse.json(
        {
          success: false,
          message: "Portfolio identifier is required.",
        },
        { status: 400 },
      );
    }

    if (!name) {
      return NextResponse.json(
        { success: false, message: "Name is required." },
        { status: 400 },
      );
    }

    if (!email && !phone) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide an email address or phone number.",
        },
        { status: 400 },
      );
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide a valid email address.",
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
            name: true,
          },
        },
      },
    });

    if (!portfolio || !portfolio.published) {
      return NextResponse.json(
        { success: false, message: "Portfolio is not available." },
        { status: 404 },
      );
    }

    let score = 10;

    if (email) score += 10;
    if (phone) score += 10;
    if (message) score += 10;
    if (interestedIn) score += 10;
    if (budget) score += 15;
    if (timeline) score += 15;

    score = Math.min(score, 100);

    let temperature: "HOT" | "WARM" | "COLD" = "COLD";

    if (score >= 70) {
      temperature = "HOT";
    } else if (score >= 45) {
      temperature = "WARM";
    }

    const lead = await prisma.lead.create({
      data: {
        portfolioId: portfolio.id,
        ownerId: portfolio.userId,
        name,
        email: email || null,
        phone: phone || null,
        company: company || null,
        location: location || null,
        message: message || null,
        source: "WEBSITE",
        status: "NEW",
        temperature,
        score,
        interestedIn: interestedIn || null,
        budget: budget || null,
        timeline: timeline || null,
        activities: {
          create: {
            userId: portfolio.userId,
            type: "NOTE",
            title: "New lead received from website",
            content:
              message ||
              "Lead submitted through the professional website.",
            metadata: {
              source: "WEBSITE",
              portfolioSlug,
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        temperature: true,
        score: true,
      },
    });

    // Save the in-app notification independently of email delivery.
    try {
      await prisma.notification.create({
        data: {
          userId: portfolio.userId,
          type: "LEAD_CREATED",
          title: "New website lead",
          message: `${lead.name} submitted a new enquiry through your website.`,
          link: "/dashboard/leads",
          metadata: {
            leadId: lead.id,
            portfolioId: portfolio.id,
            portfolioSlug,
            source: "WEBSITE",
            temperature: lead.temperature,
          },
        },
      });
    } catch (notificationError) {
      console.error(
        "Lead saved, but in-app notification creation failed:",
        notificationError,
      );
    }

    // Email is best-effort and must never undo successful lead creation.
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

        const result = await resend.emails.send({
          from: fromEmail,
          to: [ownerEmail],
          subject: `New website lead: ${lead.name}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#171923;line-height:1.6">
              <div style="padding:24px;background:#101116;color:#ffffff;border-radius:14px 14px 0 0">
                <p style="margin:0;color:#D9A441;font-size:12px;letter-spacing:2px;text-transform:uppercase">New lead notification</p>
                <h1 style="margin:10px 0 0;font-size:24px">You have a new enquiry</h1>
                <p style="margin:8px 0 0;color:#d1d5db">A visitor submitted a request through your professional website.</p>
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
            "You have a new website lead.",
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
          console.error("Resend rejected the lead email:", result.error);
        }
      }
    } catch (emailError) {
      console.error(
        "Lead saved, but email notification failed:",
        emailError,
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Your request has been received successfully.",
        lead,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Lead creation error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong while submitting your request.",
      },
      { status: 500 },
    );
  }
}