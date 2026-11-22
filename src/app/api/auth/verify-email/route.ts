import { NextResponse } from "next/server";
import { verifyEmailActionToken } from "@/lib/email-action-tokens";
import { checkAuthRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const rateLimit = await checkAuthRateLimit({
      request,
      action: "email-verification",
    });

    if (rateLimit.unavailable) {
      return NextResponse.json(
        {
          success: false,
          message: "Verification is temporarily unavailable. Please try again shortly.",
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
          message: "Too many verification attempts. Please try again later.",
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

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid verification request.",
        },
        { status: 400 },
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
          message: "Invalid verification request.",
        },
        { status: 400 },
      );
    }

    const token = (body as Record<string, unknown>).token;

    if (
      typeof token !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(token)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "This verification link is invalid or has expired. Request a new verification email if necessary.",
        },
        {
          status: 400,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const verified = await verifyEmailActionToken(token);

    if (!verified) {
      return NextResponse.json(
        {
          success: false,
          message: "This verification link is invalid, expired, or has already been used. Request a new verification email if necessary.",
        },
        {
          status: 400,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Your email address has been verified. You can now sign in.",
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    console.error("Email verification request failed.");

    return NextResponse.json(
      {
        success: false,
        message: "We could not complete verification. Please try again shortly.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
