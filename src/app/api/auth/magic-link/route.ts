import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { canSkipAdditionalIdentityVerification } from "@/lib/auth-verification-policy";
import { createEmailActionToken } from "@/lib/email-action-tokens";
import { sendMagicLinkEmail } from "@/lib/auth-email";

const GENERIC_RESPONSE = {
  success: true,
  message:
    "If a verified account exists for that email address, a secure sign-in link will be sent.",
};

function response(status = 200) {
  return NextResponse.json(GENERIC_RESPONSE, {
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
      action: "magic-link",
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
        role: true,
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

    const verifiedEmailIdentity = user?.identities.some(
      (identity) =>
        identity.providerSubject === email &&
        identity.verifiedAt !== null,
    );

    if (
      user &&
      user.email === email &&
      (canSkipAdditionalIdentityVerification(user.role) ||
        (user.emailVerifiedAt && verifiedEmailIdentity))
    ) {
      try {
        const token = await createEmailActionToken({
          userId: user.id,
          purpose: "MAGIC_LINK",
          expiresInMinutes: 15,
        });

        await sendMagicLinkEmail({
          to: email,
          name: user.name ?? "there",
          token,
        });
      } catch {
        // Keep account existence and email delivery status private.
        console.error("Magic-link delivery processing failed.");
      }
    }

    return response();
  } catch {
    console.error("Magic-link request processing failed.");

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
