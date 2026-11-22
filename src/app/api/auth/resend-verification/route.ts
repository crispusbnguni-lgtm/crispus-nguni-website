import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { createEmailActionToken } from "@/lib/email-action-tokens";
import { sendVerificationEmail } from "@/lib/auth-email";

const GENERIC_RESPONSE = {
  success: true,
  message:
    "If an account needs email verification, a new verification link will be sent to its email address.",
};

function response(
  body: typeof GENERIC_RESPONSE,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide a valid email address.",
        },
        {
          status: 400,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide a valid email address.",
        },
        {
          status: 400,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const rawEmail = (body as Record<string, unknown>).email;

    if (
      typeof rawEmail !== "string" ||
      rawEmail.length > 254
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide a valid email address.",
        },
        {
          status: 400,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const email = rawEmail.trim().toLowerCase();

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide a valid email address.",
        },
        {
          status: 400,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const rateLimit = await checkAuthRateLimit({
      request,
      action: "resend-verification",
      email,
    });

    if (rateLimit.unavailable) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This service is temporarily unavailable. Please try again shortly.",
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
            "Too many requests. Please wait before trying again.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfter),
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerifiedAt: true,
        identities: {
          where: {
            provider: "EMAIL",
          },
          select: {
            providerSubject: true,
            verifiedAt: true,
          },
        },
      },
    });

    const emailIdentity = user?.identities.find(
      (identity) => identity.providerSubject === email,
    );

    if (
      user &&
      user.email &&
      !user.emailVerifiedAt &&
      emailIdentity &&
      !emailIdentity.verifiedAt
    ) {
      try {
        const token = await createEmailActionToken({
          userId: user.id,
          purpose: "VERIFY_EMAIL",
          expiresInMinutes: 30,
        });

        await sendVerificationEmail({
          to: user.email,
          name: user.name ?? "there",
          token,
        });
      } catch {
        // Do not reveal account existence or email delivery status.
        console.error("Verification resend processing failed.");
      }
    }

    return response(GENERIC_RESPONSE);
  } catch {
    console.error("Verification resend request failed.");

    return NextResponse.json(
      {
        success: false,
        message:
          "The request could not be completed. Please try again shortly.",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}