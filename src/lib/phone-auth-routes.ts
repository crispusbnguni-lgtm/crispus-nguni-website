import "server-only";

import { NextResponse } from "next/server";
import { logSuperAdminVerificationExemption } from "@/lib/auth";
import { completePrimaryAuthentication, setPendingAuthenticationCookie } from "@/lib/auth-completion";
import { prisma } from "@/lib/prisma";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { canSkipAdditionalIdentityVerification } from "@/lib/auth-verification-policy";
import {
  createPhoneSignupAccount,
  phoneIdentityExists,
} from "@/lib/phone-auth";
import {
  isPhoneEligibleForIntent,
  isValidPhoneOtpCode,
  normalizePhoneNumber,
  verifyPhoneOtpChallenge,
  type PhoneOtpIntent,
} from "@/lib/phone-otp-core";
import {
  checkPhoneVerification,
  sendPhoneVerification,
  validateTwilioVerifyConfiguration,
} from "@/lib/twilio-verify";
import {
  consumePhoneOtpChallenge,
  createPhoneOtpChallenge,
  deletePhoneOtpChallenge,
  getPhoneOtpChallenge,
} from "@/lib/phone-otp";

function json(
  body: Record<string, unknown>,
  status = 200,
  headers: Record<string, string> = {},
) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function sendAction(intent: PhoneOtpIntent) {
  return intent === "signup" ? "phone-signup-send" : "phone-signin-send";
}

function verifyAction(intent: PhoneOtpIntent) {
  return intent === "signup" ? "phone-signup-verify" : "phone-signin-verify";
}

function rateLimitResponse(
  result: { limited: boolean; retryAfter: number; unavailable: boolean },
) {
  if (result.unavailable) {
    return json(
      { success: false, message: "Phone verification is temporarily unavailable." },
      503,
    );
  }
  if (result.limited) {
    return json(
      { success: false, message: "Too many attempts. Please try again later." },
      429,
      { "Retry-After": String(result.retryAfter) },
    );
  }
  return null;
}

export async function sendPhoneOtp(
  request: Request,
  intent: PhoneOtpIntent,
) {
  const body = await readBody(request);
  const phone = normalizePhoneNumber(body?.phone);
  const name = intent === "signup" && typeof body?.name === "string"
    ? body.name.trim()
    : "";

  if (!phone || (intent === "signup" && (!name || name.length > 100))) {
    return json(
      { success: false, message: "Enter a valid phone number and the required details." },
      400,
    );
  }

  const limit = await checkAuthRateLimit({
    request,
    action: sendAction(intent),
    phone,
  });
  const limited = rateLimitResponse(limit);
  if (limited) return limited;

  let challengeId: string | null = null;
  try {
    validateTwilioVerifyConfiguration();
    const identityExists = await phoneIdentityExists(phone);
    const eligible = isPhoneEligibleForIntent(intent, identityExists);
    challengeId = await createPhoneOtpChallenge({
      intent,
      phone,
      eligible,
      ...(intent === "signup" ? { name } : {}),
    });

    if (eligible && !(await sendPhoneVerification(phone))) {
      await deletePhoneOtpChallenge(challengeId);
      return json(
        { success: false, message: "Unable to send a verification code. Please try again." },
        503,
      );
    }

    return json({
      success: true,
      challengeId,
      message: "If this number is eligible, a verification code has been sent.",
    });
  } catch {
    if (challengeId) {
      try {
        await deletePhoneOtpChallenge(challengeId);
      } catch {
        // The challenge is short-lived and contains no OTP code.
      }
    }
    return json(
      { success: false, message: "Phone verification is temporarily unavailable." },
      503,
    );
  }
}

export async function verifyPhoneOtp(
  request: Request,
  intent: PhoneOtpIntent,
) {
  const body = await readBody(request);
  const challengeId = typeof body?.challengeId === "string" ? body.challengeId : "";
  const code = body?.code;
  if (!challengeId || challengeId.length > 64) {
    return json(
      { success: false, message: "The verification code is invalid or expired." },
      400,
    );
  }

  try {
    const challenge = await getPhoneOtpChallenge(challengeId);
    const limit = await checkAuthRateLimit({
      request,
      action: verifyAction(intent),
      ...(challenge ? { phone: challenge.phone } : {}),
    });
    const limited = rateLimitResponse(limit);
    if (limited) return limited;

    if (!isValidPhoneOtpCode(code)) {
      return json(
        { success: false, message: "The verification code is invalid or expired." },
        401,
      );
    }

    let authenticatedUserId: string | null = null;
    const completionResult: { value: Awaited<ReturnType<typeof completePrimaryAuthentication>> | null } = { value: null };
    const result = await verifyPhoneOtpChallenge({
      challenge,
      intent,
      code,
      verifyCode: checkPhoneVerification,
      consume: (expectedIntent) => consumePhoneOtpChallenge(challengeId, expectedIntent),
      complete: async (verifiedChallenge) => {
        if (intent === "signup") {
          if (!verifiedChallenge.name) return false;
          authenticatedUserId = await createPhoneSignupAccount({
            phone: verifiedChallenge.phone,
            name: verifiedChallenge.name,
          });
        } else {
          const identity = await prisma.userIdentity.findUnique({
            where: {
              provider_providerSubject: {
                provider: "PHONE",
                providerSubject: verifiedChallenge.phone,
              },
            },
            select: {
              userId: true,
              verifiedAt: true,
              user: { select: { role: true, emailVerifiedAt: true } },
            },
          });
          authenticatedUserId =
            identity &&
            (identity.verifiedAt ||
              canSkipAdditionalIdentityVerification(identity.user.role))
              ? identity.userId
              : null;
          if (
            identity &&
            canSkipAdditionalIdentityVerification(identity.user.role) &&
            !identity.verifiedAt
          ) {
            await logSuperAdminVerificationExemption(identity.userId, "PHONE", {
              emailVerified: Boolean(identity.user.emailVerifiedAt),
              phoneVerified: false,
            });
          }
        }

        if (!authenticatedUserId) return false;
        completionResult.value = await completePrimaryAuthentication(request, { userId: authenticatedUserId, method: "PHONE" });
        return true;
      },
    });

    if (result !== "verified") {
      return json(
        {
          success: false,
          message:
            result === "conflict"
              ? "We could not complete this request. If you have an account, sign in."
              : "The verification code is invalid or expired.",
        },
        result === "conflict" ? 409 : 401,
      );
    }

    const authenticationCompletion = completionResult.value;
    if (!authenticationCompletion) return json({ success: false, message: "Phone verification could not be completed." }, 503);
    const response = json(authenticationCompletion.status === "session"
      ? { success: true, message: "Phone verification successful." }
      : { success: true, pending: authenticationCompletion.status, next: authenticationCompletion.status === "enrollment" ? "/mfa/enroll" : "/mfa/challenge" });
    if (authenticationCompletion.status !== "session") setPendingAuthenticationCookie(response, authenticationCompletion);
    return response;
  } catch {
    return json(
      { success: false, message: "Phone verification is temporarily unavailable." },
      503,
    );
  }
}
