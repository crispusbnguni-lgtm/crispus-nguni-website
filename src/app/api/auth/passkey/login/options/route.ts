import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";

import { checkPasskeyRateLimit } from "@/lib/rate-limit";
import {
  getWebAuthnConfig,
  storeWebAuthnChallenge,
} from "@/lib/webauthn";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rateLimit = await checkPasskeyRateLimit({
      request,
      action: "login-options",
    });

    if (rateLimit.unavailable) {
      return NextResponse.json(
        {
          success: false,
          message: "Passkey sign-in is temporarily unavailable.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (rateLimit.limited) {
      return NextResponse.json(
        {
          success: false,
          message: "Too many passkey sign-in attempts. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(rateLimit.retryAfter),
          },
        }
      );
    }

    const config = getWebAuthnConfig();

    const options = await generateAuthenticationOptions({
      rpID: config.rpID,
      timeout: 60_000,
      userVerification: "required",
    });

    await storeWebAuthnChallenge({
      challenge: options.challenge,
      purpose: "passkey-authentication",
    });

    return NextResponse.json(
      {
        success: true,
        options,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Passkey login options error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to start passkey sign-in. Please try again.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}