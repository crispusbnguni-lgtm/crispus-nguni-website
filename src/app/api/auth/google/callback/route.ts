import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentSessionDetails,
  logSuperAdminVerificationExemption,
} from "@/lib/auth";
import {
  createVerifiedIdentity,
  linkVerifiedIdentity,
} from "@/lib/auth-identities";
import { prisma } from "@/lib/prisma";
import { canSkipAdditionalIdentityVerification } from "@/lib/auth-verification-policy";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import {
  consumeGoogleOAuthTransaction,
  exchangeGoogleAuthorizationCode,
  getGoogleOAuthConfiguration,
  googleBindingCookieName,
  GOOGLE_OAUTH_APP_ORIGIN,
  verifyGoogleIdToken,
} from "@/lib/google-oauth";
import { completePrimaryAuthentication, setPendingAuthenticationCookie, type PrimaryAuthenticationCompletion } from "@/lib/auth-completion";

export const runtime = "nodejs";

const GOOGLE_BINDING_COOKIE_PREFIX = "google_oauth_binding_";
const GOOGLE_BINDING_STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

class GoogleAccountConflictError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDuplicateGoogleEmailConstraint(error: unknown): boolean {
  if (!isRecord(error) || error.code !== "P2002" || !isRecord(error.meta)) {
    return false;
  }

  const adapterError = error.meta.driverAdapterError;
  if (!isRecord(adapterError) || !isRecord(adapterError.cause)) return false;
  const cause = adapterError.cause;
  if (cause.kind !== "UniqueConstraintViolation" || !isRecord(cause.constraint)) {
    return false;
  }

  const constraint = cause.constraint;
  const tables = [cause.table, error.meta.table].filter(
    (value) => value !== undefined,
  );
  const models = [cause.modelName, error.meta.modelName].filter(
    (value) => value !== undefined,
  );
  if (
    tables.some((value) => value !== "User") ||
    models.some((value) => value !== "User")
  ) {
    return false;
  }

  if ("index" in constraint) {
    return (
      constraint.index === "User_email_key" &&
      (!("fields" in constraint) ||
        (Array.isArray(constraint.fields) &&
          constraint.fields.length === 1 &&
          constraint.fields[0] === "email"))
    );
  }

  const physicalTable = cause.table ?? error.meta.table;
  return (
    physicalTable === "User" &&
    "fields" in constraint &&
    Array.isArray(constraint.fields) &&
    constraint.fields.length === 1 &&
    constraint.fields[0] === "email"
  );
}

function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "portfolio";
  return `${base}-${randomBytes(6).toString("hex")}`;
}

function redirect(path: string, bindingCookieName: string | null | string[], pending?: Exclude<PrimaryAuthenticationCompletion, { status: "session" }>) {
  const response = NextResponse.redirect(
    new URL(path, GOOGLE_OAUTH_APP_ORIGIN),
    303,
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");

  const cookieNames = Array.isArray(bindingCookieName)
    ? bindingCookieName
    : bindingCookieName
      ? [bindingCookieName]
      : [];
  for (const cookieName of cookieNames) {
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/api/auth/google/callback",
      maxAge: 0,
    });
  }
  if (pending) setPendingAuthenticationCookie(response, pending);

  return response;
}

function requestGoogleBindingCookieNames(request: NextRequest): string[] {
  return request.cookies
    .getAll()
    .map(({ name }) => name)
    .filter((name) => {
      if (!name.startsWith(GOOGLE_BINDING_COOKIE_PREFIX)) return false;
      return GOOGLE_BINDING_STATE_PATTERN.test(
        name.slice(GOOGLE_BINDING_COOKIE_PREFIX.length),
      );
    });
}

function failurePath(intent?: "signin" | "signup" | "link") {
  return intent === "link"
    ? "/dashboard/security/sessions?google=link-failed"
    : "/login?google=failed";
}

async function createGoogleAccount({
  email,
  name,
  sub,
}: {
  email: string;
  name: string;
  sub: string;
}): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    return await prisma.$transaction(async (transaction) => {
      const existingUser = await transaction.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
        select: { id: true },
      });

      if (existingUser) throw new GoogleAccountConflictError();

      const existingEmailIdentity = await transaction.userIdentity.findFirst({
        where: {
          provider: "EMAIL",
          OR: [
            { providerSubject: { equals: normalizedEmail, mode: "insensitive" } },
            { identifier: { equals: normalizedEmail, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      if (existingEmailIdentity) throw new GoogleAccountConflictError();

      const user = await transaction.user.create({
        data: {
          name,
          email: normalizedEmail,
          emailVerifiedAt: new Date(),
          role: "USER",
          portfolioSite: {
            create: {
              name,
              title: "Professional Portfolio",
              bio: "Welcome to my professional portfolio.",
              slug: makeSlug(name),
              published: false,
            },
          },
        },
        select: { id: true },
      });

      const identity = await createVerifiedIdentity(
        user.id,
        {
          provider: "GOOGLE",
          providerSubject: sub,
          identifier: normalizedEmail,
        },
        transaction,
      );

      if (identity.status !== "created") {
        throw new GoogleAccountConflictError();
      }

      return user.id;
    });
  } catch (error) {
    if (
      error instanceof GoogleAccountConflictError ||
      isDuplicateGoogleEmailConstraint(error)
    ) {
      return null;
    }
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const states = request.nextUrl.searchParams.getAll("state");
  const state = states[0] ?? "";
  const cookieName = googleBindingCookieName(state);

  if (states.length !== 1 || !cookieName) {
    return redirect(
      "/login?google=failed",
      requestGoogleBindingCookieNames(request),
    );
  }

  const bindingSecret = request.cookies.get(cookieName)?.value ?? "";
  const rateLimit = await checkAuthRateLimit({
    request,
    action: "google-callback",
  });

  if (rateLimit.unavailable || rateLimit.limited) {
    return redirect("/login?google=unavailable", cookieName);
  }

  let callbackIntent: "signin" | "signup" | "link" | undefined;
  try {
    const transaction = await consumeGoogleOAuthTransaction(state, bindingSecret);
    if (!transaction) return redirect("/login?google=failed", cookieName);
    callbackIntent = transaction.intent;

    getGoogleOAuthConfiguration();
    const providerErrors = request.nextUrl.searchParams.getAll("error");
    if (providerErrors.length > 0) {
      return redirect(failurePath(transaction.intent), cookieName);
    }

    const codes = request.nextUrl.searchParams.getAll("code");
    if (codes.length !== 1 || !codes[0]) {
      return redirect(failurePath(transaction.intent), cookieName);
    }

    const idToken = await exchangeGoogleAuthorizationCode({
      code: codes[0],
      codeVerifier: transaction.codeVerifier,
    });
    if (!idToken) return redirect(failurePath(transaction.intent), cookieName);

    const identity = await verifyGoogleIdToken(idToken, transaction.nonce);
    if (!identity) return redirect(failurePath(transaction.intent), cookieName);

    if (transaction.intent === "signin") {
      const linkedIdentity = await prisma.userIdentity.findUnique({
        where: {
          provider_providerSubject: {
            provider: "GOOGLE",
            providerSubject: identity.sub,
          },
        },
        select: {
          userId: true,
          verifiedAt: true,
          user: { select: { id: true, role: true } },
        },
      });

      if (
        !linkedIdentity ||
        (!linkedIdentity.verifiedAt &&
          !canSkipAdditionalIdentityVerification(linkedIdentity.user.role))
      ) {
        return redirect("/login?google=not-linked", cookieName);
      }
      if (
        canSkipAdditionalIdentityVerification(linkedIdentity.user.role) &&
        !linkedIdentity.verifiedAt
      ) {
        await logSuperAdminVerificationExemption(
          linkedIdentity.user.id,
          "GOOGLE",
          { emailVerified: false },
        );
      }
      const completion = await completePrimaryAuthentication(request, { userId: linkedIdentity.user.id, method: "GOOGLE" });
      return completion.status === "session"
        ? redirect("/dashboard", cookieName)
        : redirect(completion.status === "enrollment" ? "/mfa/enroll" : "/mfa/challenge", cookieName, completion);
    }

    if (transaction.intent === "signup") {
      if (!identity.emailVerified || !identity.email) {
        return redirect("/login?google=failed", cookieName);
      }

      const name = identity.name || identity.email.split("@")[0] || "Google user";
      const userId = await createGoogleAccount({
        email: identity.email,
        name,
        sub: identity.sub,
      });

      if (!userId) {
        return redirect(
          "/login?google=continue",
          cookieName,
        );
      }

      const completion = await completePrimaryAuthentication(request, { userId, method: "GOOGLE" });
      return completion.status === "session"
        ? redirect("/dashboard", cookieName)
        : redirect(completion.status === "enrollment" ? "/mfa/enroll" : "/mfa/challenge", cookieName, completion);
    }

    if (!transaction.sessionId || !transaction.userId) {
      return redirect(failurePath("link"), cookieName);
    }

    const currentSession = await getCurrentSessionDetails();
    if (
      !currentSession ||
      currentSession.id !== transaction.sessionId ||
      currentSession.userId !== transaction.userId
    ) {
      return redirect("/login?google=reauthenticate", cookieName);
    }

    const linkResult = await linkVerifiedIdentity(
      {
        provider: "GOOGLE",
        providerSubject: identity.sub,
        identifier: identity.emailVerified ? identity.email : null,
      },
      transaction.sessionId,
    );

    if (linkResult.status === "conflict") {
      return redirect(failurePath("link"), cookieName);
    }

    return redirect(
      "/dashboard/security/sessions?google=linked",
      cookieName,
    );
  } catch {
    // Do not log provider responses, authorization codes, tokens, or secrets.
    return redirect(failurePath(callbackIntent), cookieName);
  }
}
