
import { NextResponse } from "next/server";
import argon2 from "argon2";
import { prisma } from "@/lib/prisma";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { createEmailActionToken } from "@/lib/email-action-tokens";
import { sendVerificationEmail } from "@/lib/auth-email";

function createSlug(name: string) {
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${baseSlug || "portfolio"}-${Date.now().toString(36)}`;
}

function neutralSignupResponse() {
  return NextResponse.json(
    {
      success: true,
      message:
        "If signup can proceed, further instructions will be communicated by email.",
      verificationRequired: true,
    },
    {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function isDuplicateEmailConstraint(error: unknown) {
  if (
    !error ||
    typeof error !== "object" ||
    !("code" in error) ||
    error.code !== "P2002" ||
    !("meta" in error)
  ) {
    return false;
  }

  const meta = error.meta;

  if (!meta || typeof meta !== "object") return false;

  const adapterError =
    "driverAdapterError" in meta
      ? meta.driverAdapterError
      : undefined;

  if (
    !adapterError ||
    typeof adapterError !== "object" ||
    !("cause" in adapterError)
  ) {
    return false;
  }

  const cause = adapterError.cause;

  if (
    !cause ||
    typeof cause !== "object" ||
    !("kind" in cause) ||
    cause.kind !== "UniqueConstraintViolation" ||
    !("constraint" in cause)
  ) {
    return false;
  }

  const constraint = cause.constraint;

  if (!constraint || typeof constraint !== "object") return false;

  const reportedTables = [
    "table" in cause ? cause.table : undefined,
    "table" in meta ? meta.table : undefined,
  ].filter((table) => table !== undefined);

  const reportedModels = [
    "modelName" in cause ? cause.modelName : undefined,
    "modelName" in meta ? meta.modelName : undefined,
  ].filter((model) => model !== undefined);

  if (
    reportedTables.some((table) => table !== "User") ||
    reportedModels.some((model) => model !== "User")
  ) {
    return false;
  }

  if ("index" in constraint && constraint.index === "User_email_key") {
    return (
      !("fields" in constraint) ||
      (Array.isArray(constraint.fields) &&
        constraint.fields.length === 1 &&
        constraint.fields[0] === "email")
    );
  }

  const physicalTable =
    "table" in cause && cause.table !== undefined
      ? cause.table
      : "table" in meta
        ? meta.table
        : undefined;

  return (
    !("index" in constraint) &&
    "fields" in constraint &&
    Array.isArray(constraint.fields) &&
    constraint.fields.length === 1 &&
    constraint.fields[0] === "email" &&
    physicalTable === "User"
  );
}

export async function POST(request: Request) {
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

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    // Preserve intentional leading and trailing spaces in passwords.
    const password =
      typeof body.password === "string" ? body.password : "";

    if (!name || !email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Name, email and password are required.",
        },
        { status: 400 },
      );
    }

    if (
      name.length > 100 ||
      email.length > 254 ||
      password.length > 1024
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Please check the length of your details.",
        },
        { status: 400 },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        {
          success: false,
          message: "Please enter a valid email address.",
        },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          message: "Password must be at least 8 characters.",
        },
        { status: 400 },
      );
    }

    const rateLimit = await checkAuthRateLimit({
      request,
      action: "signup",
    });

    if (rateLimit.unavailable) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Signup is temporarily unavailable. Please try again shortly.",
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
          message:
            "Too many signup attempts. Please try again later.",
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

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return neutralSignupResponse();
    }

    const passwordHash = await argon2.hash(password);
    const slug = createSlug(name);

    let user;

    try {
      user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: "USER",
          identities: {
            create: {
              provider: "EMAIL",
              providerSubject: email,
              identifier: email,
            },
          },
          portfolioSite: {
            create: {
              name,
              title: "Professional Portfolio",
              bio: "Welcome to my professional portfolio.",
              slug,
              published: false,
            },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });
    } catch (error) {
      if (isDuplicateEmailConstraint(error)) {
        return neutralSignupResponse();
      }

      throw error;
    }

    try {
      const token = await createEmailActionToken({
        userId: user.id,
        purpose: "VERIFY_EMAIL",
        expiresInMinutes: 30,
      });

      await sendVerificationEmail({
        to: email,
        name,
        token,
      });
    } catch (deliveryError) {
      console.error(
        "Signup verification could not be completed. Cleaning up pending account.",
      );

      try {
        await prisma.user.deleteMany({
          where: {
            id: user.id,
            email,
            emailVerifiedAt: null,
          },
        });
      } catch {
        console.error(
          "Pending signup cleanup failed. Manual investigation may be required.",
        );
      }

      throw deliveryError;
    }

    return neutralSignupResponse();
  } catch {
    console.error("Signup request failed.");

    return NextResponse.json(
      {
        success: false,
        message:
          "We could not complete your signup. Please try again shortly.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
