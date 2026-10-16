
import { NextResponse } from "next/server";
import argon2 from "argon2";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { checkAuthRateLimit } from "@/lib/rate-limit";

function createSlug(name: string) {
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${baseSlug || "portfolio"}-${Date.now().toString(36)}`;
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
      return NextResponse.json(
        {
          success: false,
          message: "An account with that email already exists.",
        },
        { status: 409 },
      );
    }

    const passwordHash = await argon2.hash(password);
    const slug = createSlug(name);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "USER",
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
        role: true,
      },
    });

    await createSession(user.id, request);

    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully.",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("Signup error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Something went wrong while creating your account.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
