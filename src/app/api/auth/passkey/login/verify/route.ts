import { NextResponse } from "next/server";
import {
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";

import { completePrimaryAuthentication, setPendingAuthenticationCookie } from "@/lib/auth-completion";
import { prisma } from "@/lib/prisma";
import { checkPasskeyRateLimit } from "@/lib/rate-limit";
import {
  consumeWebAuthnChallenge,
  getWebAuthnConfig,
} from "@/lib/webauthn";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  try {
    const rateLimit = await checkPasskeyRateLimit({
      request,
      action: "login-verify",
    });

    if (rateLimit.unavailable) {
      return errorResponse(
        "Passkey sign-in is temporarily unavailable.",
        503
      );
    }

    if (rateLimit.limited) {
      return NextResponse.json(
        {
          success: false,
          message: "Too many passkey attempts. Please try again later.",
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

    const passkeyResponse = body.response;

    if (
      !passkeyResponse ||
      typeof passkeyResponse !== "object" ||
      Array.isArray(passkeyResponse)
    ) {
      return errorResponse("Invalid passkey response.", 400);
    }

    const authenticationResponse =
      passkeyResponse as AuthenticationResponseJSON;

    if (
      typeof authenticationResponse.id !== "string" ||
      typeof authenticationResponse.rawId !== "string" ||
      authenticationResponse.id !== authenticationResponse.rawId ||
      typeof authenticationResponse.response?.clientDataJSON !== "string" ||
      typeof authenticationResponse.response?.authenticatorData !== "string" ||
      typeof authenticationResponse.response?.signature !== "string" ||
      typeof authenticationResponse.response?.userHandle !== "string"
    ) {
      return errorResponse("Incomplete passkey response.", 400);
    }

    let clientData: unknown;

    try {
      const decoded = Buffer.from(
        authenticationResponse.response.clientDataJSON,
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
      clientDataRecord.type !== "webauthn.get" ||
      typeof clientDataRecord.challenge !== "string"
    ) {
      return errorResponse("Invalid passkey authentication challenge.", 400);
    }

    const passkey = await prisma.passkeyCredential.findUnique({
      where: {
        credentialId: authenticationResponse.id,
      },
      include: {
        user: true,
      },
    });

    if (!passkey || passkey.revokedAt || !passkey.user) {
      return errorResponse("Invalid passkey or sign-in credentials.", 401);
    }

    const userHandle = Buffer.from(
      authenticationResponse.response.userHandle,
      "base64url"
    ).toString("utf8");

    if (userHandle !== passkey.userId) {
      return errorResponse("Passkey account verification failed.", 401);
    }

    const challenge = clientDataRecord.challenge;
    const config = getWebAuthnConfig();

    const challengeValid = await consumeWebAuthnChallenge({
      challenge,
      purpose: "passkey-authentication",
    });

    if (!challengeValid) {
      return errorResponse(
        "This sign-in request has expired or has already been used. Please try again.",
        400
      );
    }

    const verification = await verifyAuthenticationResponse({
      response: authenticationResponse,
      expectedChallenge: challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
        transports: passkey.transports as never,
      },
      requireUserVerification: true,
    });

    if (
      !verification.verified ||
      !verification.authenticationInfo.userVerified ||
      verification.authenticationInfo.credentialID !== passkey.credentialId
    ) {
      return errorResponse("Passkey verification failed.", 401);
    }

    const updated = await prisma.passkeyCredential.updateMany({
      where: {
        id: passkey.id,
        userId: passkey.userId,
        revokedAt: null,
        counter: passkey.counter,
      },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        deviceType: verification.authenticationInfo.credentialDeviceType,
        backedUp: verification.authenticationInfo.credentialBackedUp,
        lastUsedAt: new Date(),
      },
    });

    if (updated.count !== 1) {
      return errorResponse(
        "This passkey was changed or revoked. Please try signing in again.",
        401
      );
    }

    const completion = await completePrimaryAuthentication(request, { userId: passkey.userId, method: "PASSKEY" });
    const response = NextResponse.json(completion.status === "session"
      ? { success: true, message: "Passkey sign-in successful." }
      : { success: true, pending: completion.status, next: completion.status === "enrollment" ? "/mfa/enroll" : "/mfa/challenge" }, { headers: { "Cache-Control": "no-store" } });
    if (completion.status !== "session") setPendingAuthenticationCookie(response, completion);
    return response;
  } catch (error) {
    console.error("Passkey login verification error:", error);

    return errorResponse(
      "Unable to verify this passkey. Please try again.",
      503
    );
  }
}
