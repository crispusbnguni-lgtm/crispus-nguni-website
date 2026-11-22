
import { NextResponse } from "next/server";
import { consumeVerifiedMagicLink } from "@/lib/email-action-tokens";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { logSuperAdminVerificationExemption } from "@/lib/auth";
import { completePrimaryAuthentication, setPendingAuthenticationCookie } from "@/lib/auth-completion";

function jsonResponse(
  body: {
    success: boolean;
    message?: string;
    pending?: "enrollment" | "mfa";
    next?: string;
  },
  status: number,
  headers?: Record<string, string>,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export async function POST(request: Request) {
  try {
    const rateLimit = await checkAuthRateLimit({
      request,
      action: "magic-link-verify",
    });

    if (rateLimit.unavailable) {
      return jsonResponse(
        {
          success: false,
          message:
            "Sign-in verification is temporarily unavailable. Please try again shortly.",
        },
        503,
      );
    }

    if (rateLimit.limited) {
      return jsonResponse(
        {
          success: false,
          message:
            "Too many verification attempts. Please try again later.",
        },
        429,
        {
          "Retry-After": String(rateLimit.retryAfter),
        },
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          message: "Invalid sign-in request.",
        },
        400,
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid sign-in request.",
        },
        400,
      );
    }

    const token = (body as Record<string, unknown>).token;

    if (
      typeof token !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(token)
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "This sign-in link is invalid or has expired. Request a new link if necessary.",
        },
        400,
      );
    }

    const result = await consumeVerifiedMagicLink(token);

    if (!result) {
      return jsonResponse(
        {
          success: false,
          message:
            "This sign-in link is invalid, expired, or has already been used. Request a new link if necessary.",
        },
        400,
      );
    }

    if (result.verificationExempt) {
      await logSuperAdminVerificationExemption(result.userId, "EMAIL", {
        emailVerified: false,
      });
    }

    const completion = await completePrimaryAuthentication(request, { userId: result.userId, method: "EMAIL" });
    const response = jsonResponse(completion.status === "session"
      ? { success: true, message: "You have signed in successfully." }
      : { success: true, pending: completion.status, next: completion.status === "enrollment" ? "/mfa/enroll" : "/mfa/challenge" }, 200);
    if (completion.status !== "session") setPendingAuthenticationCookie(response, completion);
    return response;
  } catch {
    console.error("Magic-link verification failed.");

    return jsonResponse(
      {
        success: false,
        message:
          "We could not complete sign-in. Please try again shortly.",
      },
      500,
    );
  }
}
