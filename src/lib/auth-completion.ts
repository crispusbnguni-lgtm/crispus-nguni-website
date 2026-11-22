import "server-only";

import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import {
  createPendingMfaChallengeForVerifiedPrimary,
  isVerifiedMfaChallengeCompletion,
  type MfaChallengeCompletion,
} from "@/lib/mfa-security";
import type { MfaPrimaryAuthMethod } from "@/lib/mfa-challenges";

export type PrimaryAuthenticationCompletion =
  | { status: "session" }
  | { status: "enrollment"; authorization: { token: string; expiresAt: number } }
  | { status: "mfa"; challenge: { token: string; expiresAt: number } };

/** Invoke only after the provider has verified its primary credential and resolved the account. */
export async function completePrimaryAuthentication(
  request: Request,
  verified: Readonly<{ userId: string; method: MfaPrimaryAuthMethod }>,
): Promise<PrimaryAuthenticationCompletion> {
  const decision = await createPendingMfaChallengeForVerifiedPrimary({
    userId: verified.userId,
    primaryAuthMethod: verified.method,
  });
  if (decision.required && decision.enrollmentRequired) {
    return { status: "enrollment", authorization: decision.authorization };
  }
  if (decision.required) return { status: "mfa", challenge: decision.challenge };
  await createSession(verified.userId, request, { primaryAuthMethod: verified.method });
  return { status: "session" };
}

export function setPendingAuthenticationCookie(
  response: NextResponse,
  pending: Extract<Awaited<ReturnType<typeof completePrimaryAuthentication>>, { status: "enrollment" | "mfa" }>,
): void {
  const credential = pending.status === "enrollment" ? pending.authorization : pending.challenge;
  const maxAge = Math.max(0, Math.min(300, Math.floor((credential.expiresAt - Date.now()) / 1000)));
  if (maxAge < 1 || !/^[A-Za-z0-9_-]{43}$/.test(credential.token)) {
    throw new Error("Pending authentication could not be established.");
  }
  response.cookies.set(
    pending.status === "enrollment" ? "mfa_enrollment_pending" : "mfa_login_pending",
    credential.token,
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: pending.status === "enrollment" ? "/api/auth/mfa/enrollment" : "/api/auth/mfa/complete",
      maxAge,
    },
  );
}

export async function finalizeMfaLogin(
  request: Request,
  completion: MfaChallengeCompletion,
): Promise<void> {
  if (!isVerifiedMfaChallengeCompletion(completion) || completion.purpose !== "LOGIN") {
    throw new Error("Verified MFA completion is required.");
  }
  await createSession(completion.userId, request, {
    primaryAuthMethod: completion.primaryAuthMethod,
    verifiedMfa: {
      secondFactorMethod: completion.secondFactorMethod,
      verifiedAt: completion.verifiedAt,
    },
  });
}
