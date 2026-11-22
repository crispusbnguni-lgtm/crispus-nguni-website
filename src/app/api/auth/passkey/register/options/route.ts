
import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getWebAuthnConfig,
  storeWebAuthnChallenge,
} from "@/lib/webauthn";
import { checkPasskeyRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Please sign in before registering a passkey.",
        },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!user.email || !user.emailVerifiedAt) {
      return NextResponse.json(
        {
          success: false,
          message: "Verify your email address before registering a passkey.",
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const emailIdentity = await prisma.userIdentity.findFirst({
      where: {
        userId: user.id,
        provider: "EMAIL",
        providerSubject: user.email,
        identifier: user.email,
        verifiedAt: { not: null },
      },
      select: { id: true },
    });

    if (!emailIdentity) {
      return NextResponse.json(
        {
          success: false,
          message: "A verified email identity is required to register a passkey.",
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const rateLimit = await checkPasskeyRateLimit({
      request,
      action: "register-options",
      userId: user.id,
    });

    if (rateLimit.unavailable) {
      return NextResponse.json(
        {
          success: false,
          message: "Passkey registration is temporarily unavailable.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (rateLimit.limited) {
      return NextResponse.json(
        {
          success: false,
          message: "Too many passkey registration attempts. Please try again later.",
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

    const existingPasskeys = await prisma.passkeyCredential.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      select: {
        credentialId: true,
        transports: true,
      },
    });

    const options = await generateRegistrationOptions({
      rpName: config.rpName,
      rpID: config.rpID,
      userName: user.email,
      userID: new TextEncoder().encode(user.id),
      userDisplayName: user.name || user.email,
      attestationType: "none",
      timeout: 60_000,
      excludeCredentials: existingPasskeys.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports,
      })),
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
    });

    await storeWebAuthnChallenge({
      challenge: options.challenge,
      purpose: "passkey-registration",
      userId: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        options,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Passkey registration options error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to start passkey registration. Please try again.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
