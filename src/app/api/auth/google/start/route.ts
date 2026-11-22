import { NextRequest, NextResponse } from "next/server";
import { getCurrentSessionDetails } from "@/lib/auth";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import {
  createGoogleOAuthTransaction,
  GOOGLE_OAUTH_APP_ORIGIN,
  type GoogleOAuthIntent,
} from "@/lib/google-oauth";

export const runtime = "nodejs";

function jsonError(message: string, status: number, retryAfter?: number) {
  return NextResponse.json(
    { success: false, message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
      },
    },
  );
}

function safeRedirect(path: string) {
  const response = NextResponse.redirect(
    new URL(path, GOOGLE_OAUTH_APP_ORIGIN),
    303,
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest) {
  const intents = request.nextUrl.searchParams.getAll("intent");
  const intent = intents[0];

  if (
    intents.length !== 1 ||
    (intent !== "signin" && intent !== "signup" && intent !== "link")
  ) {
    return jsonError("A valid Google sign-in intent is required.", 400);
  }

  const rateLimit = await checkAuthRateLimit({
    request,
    action: "google-start",
  });

  if (rateLimit.unavailable) {
    return jsonError("Google sign-in is temporarily unavailable.", 503);
  }
  if (rateLimit.limited) {
    return jsonError(
      "Too many Google sign-in attempts. Please try again later.",
      429,
      rateLimit.retryAfter,
    );
  }

  let session: { id: string; userId: string } | undefined;
  if (intent === "link") {
    const current = await getCurrentSessionDetails();
    if (!current) return safeRedirect("/login?google=link-auth-required");
    session = { id: current.id, userId: current.userId };
  }

  try {
    const transaction = await createGoogleOAuthTransaction({
      intent: intent as GoogleOAuthIntent,
      ...(session ? { session } : {}),
    });

    const response = NextResponse.redirect(transaction.authorizationUrl, 302);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.cookies.set(
      transaction.bindingCookieName,
      transaction.bindingSecret,
      {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/api/auth/google/callback",
        maxAge: 300,
      },
    );
    return response;
  } catch {
    return safeRedirect("/login?google=unavailable");
  }
}
