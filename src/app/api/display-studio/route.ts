
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEFAULT_PREFERENCES = {
  textScale: 1,
  readingWidth: "normal",
  fontFamily: "one-ui",
  glassLevel: 0.72,
  frostLevel: 0,
  transparency: 0.72,
  reflectionLevel: 0.65,
  glassDepth: 0.65,
  appearancePreset: "crispus",
  lineHeight: "normal",
  letterSpacing: "normal",
  colorMode: "dark",
  highContrast: false,
  reduceMotion: false,
  reduceTransparency: false,
  underlineLinks: false,
  focusMode: false,
};

function validatePreferences(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const input = value as Record<string, unknown>;

  const isNumber = (key: string, min: number, max: number) =>
    typeof input[key] === "number" &&
    Number.isFinite(input[key]) &&
    (input[key] as number) >= min &&
    (input[key] as number) <= max;

  const isBoolean = (key: string) =>
    typeof input[key] === "boolean";

  const isChoice = (key: string, choices: string[]) =>
    typeof input[key] === "string" &&
    choices.includes(input[key] as string);

  const valid =
    isNumber("textScale", 0.8, 1.6) &&
    isChoice("readingWidth", ["normal", "wide"]) &&
    isChoice("fontFamily", [
      "one-ui",
      "samsung-one",
      "inter",
      "geist",
      "system",
      "serif",
      "mono",
    ]) &&
    isNumber("glassLevel", 0, 1) &&
    isNumber("frostLevel", 0, 1) &&
    isNumber("transparency", 0, 1) &&
    isNumber("reflectionLevel", 0, 1) &&
    isNumber("glassDepth", 0, 1) &&
    isChoice("appearancePreset", [
      "crispus",
      "crystal",
      "emerald",
      "light",
    ]) &&
    isChoice("lineHeight", ["normal", "relaxed", "loose"]) &&
    isChoice("letterSpacing", ["normal", "wide", "wider"]) &&
    isChoice("colorMode", ["dark", "light", "sepia"]) &&
    isBoolean("highContrast") &&
    isBoolean("reduceMotion") &&
    isBoolean("reduceTransparency") &&
    isBoolean("underlineLinks") &&
    isBoolean("focusMode");

  if (!valid) return null;

  // Only accept known preference keys.
  return Object.fromEntries(
    Object.keys(DEFAULT_PREFERENCES).map((key) => [
      key,
      input[key],
    ])
  );
}

export async function GET() {
  try {
    const settings = await prisma.displayStudioSettings.findUnique({
      where: { id: "main" },
    });

    return NextResponse.json({
      preferences:
        settings?.preferences ?? DEFAULT_PREFERENCES,
    });
  } catch (error) {
    console.error("Failed to load Display Studio defaults:", error);

    return NextResponse.json(
      { error: "Unable to load display settings." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Super Admin access required." },
        { status: 403 }
      );
    }

    const body: unknown = await request.json();

    const preferences = validatePreferences(
      body &&
        typeof body === "object" &&
        "preferences" in body
        ? (body as { preferences: unknown }).preferences
        : null
    );

    if (!preferences) {
      return NextResponse.json(
        { error: "Invalid display preferences." },
        { status: 400 }
      );
    }

    const settings = await prisma.displayStudioSettings.upsert({
      where: { id: "main" },
      create: {
        id: "main",
        preferences,
      },
      update: {
        preferences,
      },
    });

    return NextResponse.json({
      success: true,
      preferences: settings.preferences,
    });
  } catch (error) {
    console.error("Failed to save Display Studio defaults:", error);

    return NextResponse.json(
      { error: "Unable to save display settings. Check administrator access." },
      { status: 500 }
    );
  }
}