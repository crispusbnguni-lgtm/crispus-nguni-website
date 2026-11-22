import { NextResponse } from "next/server";
import {
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  consumeWebAuthnChallenge,
  getWebAuthnConfig,
} from "@/lib/webauthn";
import { checkPasskeyRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Please sign in before registering a passkey.", 401);
    }

    if (!user.email || !user.emailVerifiedAt) {
      return errorResponse(
        "Verify your email address before registering a passkey.",
        403
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
      return errorResponse(
        "A verified email identity is required to register a passkey.",
        403
      );
    }

    const rateLimit = await checkPasskeyRateLimit({
      request,
      action: "register-verify",
      userId: user.id,
    });

    if (rateLimit.unavailable) {
      return errorResponse(
        "Passkey registration is temporarily unavailable.",
        503
      );
    }

    if (rateLimit.limited) {
      return NextResponse.json(
        {
          success: false,
          message: "Too many registration attempts. Please try again later.",
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

    let body: Record<string, unknown>;

    try {
      const parsed: unknown = await request.json();

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        return errorResponse("Invalid request body.", 400);
      }

      body = parsed as Record<string, unknown>;
    } catch {
      return errorResponse("Invalid request body.", 400);
    }

    const response = body.response;

    if (
      !response ||
      typeof response !== "object" ||
      Array.isArray(response)
    ) {
      return errorResponse("Invalid passkey response.", 400);
    }

    const registrationResponse = response as RegistrationResponseJSON;

    if (
      typeof registrationResponse.id !== "string" ||
      typeof registrationResponse.response?.clientDataJSON !== "string"
    ) {
      return errorResponse("Incomplete passkey response.", 400);
    }

    let clientData: unknown;

    try {
      const decoded = Buffer.from(
        registrationResponse.response.clientDataJSON,
        "base64url"
      ).toString("utf8");

      clientData = JSON.parse(decoded);
    } catch {
      return errorResponse("Invalid passkey challenge data.", 400);
    }

    if (
      !clientData ||
      typeof clientData !== "object" ||
      Array.isArray(clientData)
    ) {
      return errorResponse("Invalid passkey challenge data.", 400);
    }

    const clientDataRecord = clientData as Record<string, unknown>;

    if (
      clientDataRecord.type !== "webauthn.create" ||
      typeof clientDataRecord.challenge !== "string"
    ) {
      return errorResponse("Invalid passkey registration challenge.", 400);
    }

    const challenge = clientDataRecord.challenge;
    const config = getWebAuthnConfig();

    const challengeValid = await consumeWebAuthnChallenge({
      challenge,
      purpose: "passkey-registration",
      userId: user.id,
    });

    if (!challengeValid) {
      return errorResponse(
        "This registration request has expired or has already been used. Please try again.",
        400
      );
    }

    const verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge: challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return errorResponse("Passkey verification failed.", 400);
    }

    const credential = verification.registrationInfo.credential;

    const existingCredential = await prisma.passkeyCredential.findUnique({
      where: { credentialId: credential.id },
      select: { id: true },
    });

    if (existingCredential) {
      return errorResponse(
        "This passkey is already registered. Try another device credential.",
        409
      );
    }

    const suppliedName =
      typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";

    const passkeyName =
      suppliedName || "Passkey";

    await prisma.passkeyCredential.create({
      data: {
        userId: user.id,
        credentialId: credential.id,
        publicKey: credential.publicKey,
        counter: BigInt(credential.counter),
        transports: credential.transports ?? [],
        deviceType: verification.registrationInfo.credentialDeviceType,
        backedUp: verification.registrationInfo.credentialBackedUp,
        name: passkeyName,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Passkey registered successfully.",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return errorResponse("This passkey is already registered.", 409);
    }

    console.error("Passkey registration verification error:", error);

    return errorResponse(
      "Unable to verify this passkey. Please try again.",
      503
    );
  }
}
