
import { NextResponse } from "next/server";
import argon2 from "argon2";
import { prisma } from "@/lib/prisma";
import { logSuperAdminVerificationExemption } from "@/lib/auth";
import { completePrimaryAuthentication, setPendingAuthenticationCookie } from "@/lib/auth-completion";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { canSkipAdditionalIdentityVerification } from "@/lib/auth-verification-policy";
import { reportAuthOperationFailure, type AuthDiagnosticOperation } from "@/lib/auth-diagnostics";

export async function POST(request: Request) {
  let diagnosticOperation: AuthDiagnosticOperation = "LOGIN_ACCOUNT_LOOKUP";
  try {
    let body: Record<string, unknown>;

    try {
      const parsed: unknown = await request.json();

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid request body.",
          },
          { status: 400 },
        );
      }

      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request body.",
        },
        { status: 400 },
      );
    }

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    // Do not trim passwords: leading and trailing spaces can be intentional.
    const password =
      typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Email and password are required.",
        },
        { status: 400 },
      );
    }

    if (email.length > 254 || password.length > 1024) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password.",
        },
        { status: 401 },
      );
    }

    const rateLimit = await checkAuthRateLimit({
      request,
      action: "login",
      email,
    });

    if (rateLimit.unavailable) {
      return NextResponse.json(
        {
          success: false,
          message: "Login is temporarily unavailable. Please try again shortly.",
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
          message: "Too many login attempts. Please try again later.",
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
      include: {
        identities: {
          where: { provider: "EMAIL" },
          select: {
            providerSubject: true,
            verifiedAt: true,
          },
        },
      },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password.",
        },
        { status: 401 },
      );
    }

    diagnosticOperation = "LOGIN_PASSWORD_VERIFY";
    const passwordValid = await argon2.verify(
      user.passwordHash,
      password,
    );

    if (!passwordValid) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password.",
        },
        { status: 401 },
      );
    }

    const emailIdentity = user.identities.find(
      (identity) => identity.providerSubject === email,
    );

    if (
      !canSkipAdditionalIdentityVerification(user.role) &&
      (!user.emailVerifiedAt ||
        (user.identities.length > 0 &&
          (!emailIdentity || !emailIdentity.verifiedAt)))
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Please verify your email address before signing in. Check your inbox for the verification link.",
        },
        {
          status: 403,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
    if (canSkipAdditionalIdentityVerification(user.role) && (!user.emailVerifiedAt || !emailIdentity?.verifiedAt)) {
      await logSuperAdminVerificationExemption(user.id, "EMAIL", {
        emailVerified: Boolean(user.emailVerifiedAt && emailIdentity?.verifiedAt),
      });
    }
    diagnosticOperation = "LOGIN_MFA_COMPLETION";
    const completion = await completePrimaryAuthentication(request, { userId: user.id, method: "EMAIL" });
    const response = NextResponse.json(
      completion.status === "session"
        ? { success: true, message: "Login successful.", user: { id: user.id, name: user.name, email: user.email, role: user.role } }
        : { success: true, pending: completion.status, next: completion.status === "enrollment" ? "/mfa/enroll" : "/mfa/challenge" },
      { headers: { "Cache-Control": "no-store" } },
    );
    if (completion.status !== "session") setPendingAuthenticationCookie(response, completion);
    return response;
  } catch (error) {
    reportAuthOperationFailure(diagnosticOperation, error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong while logging in.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
