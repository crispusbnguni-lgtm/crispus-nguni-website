
import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiPermission, requireSameOriginApiRequest } from "@/lib/authorization";
import { resolveAdminAuditActor, writeAdminAudit } from "@/lib/admin-audit";
import { DEFAULT_DISPLAY_STUDIO_PREFERENCES } from "@/lib/display-studio-preferences";
import { reportOperationalFailure } from "@/lib/observability";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function validatePreferences(
  value: unknown
): Prisma.InputJsonObject | null {
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

  // Keep only recognized preference keys and JSON-compatible values.
  const preferences: Record<string, Prisma.InputJsonValue> = {};

  for (const key of Object.keys(DEFAULT_DISPLAY_STUDIO_PREFERENCES)) {
    const preferenceValue = input[key];

    if (
      typeof preferenceValue !== "string" &&
      typeof preferenceValue !== "number" &&
      typeof preferenceValue !== "boolean"
    ) {
      return null;
    }

    preferences[key] = preferenceValue;
  }

  return preferences;
}

export async function GET() {
  try {
    const authorization = await requireApiPermission("SYSTEM_CONFIGURE");
    if (authorization.response) return authorization.response;

    const settings = await prisma.displayStudioSettings.findUnique({
      where: { id: "main" },
    });

    return NextResponse.json(
      { preferences: settings?.preferences ?? DEFAULT_DISPLAY_STUDIO_PREFERENCES },
      { headers: NO_STORE_HEADERS },
    );
  } catch (cause) {
    reportOperationalFailure("DISPLAY_STUDIO_ADMIN_READ_FAILED", { cause });

    return NextResponse.json(
      { error: "Unable to load display settings." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authorization = await requireApiPermission("SYSTEM_CONFIGURE");
    if (authorization.response) return authorization.response;
    const originResponse = requireSameOriginApiRequest(request);
    if (originResponse) return originResponse;

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
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const actor = await resolveAdminAuditActor();
    const settings = await prisma.$transaction(async (tx) => {
      const existing = await tx.displayStudioSettings.findUnique({
        where: { id: "main" },
        select: { preferences: true },
      });
      const settings = await tx.displayStudioSettings.upsert({
        where: { id: "main" },
        create: {
          id: "main",
          preferences,
        },
        update: {
          preferences,
        },
      });

      const previousPreferences =
        existing?.preferences && typeof existing.preferences === "object" && !Array.isArray(existing.preferences)
          ? existing.preferences as Record<string, unknown>
          : {};
      const changedFields = Object.keys(DEFAULT_DISPLAY_STUDIO_PREFERENCES).filter(
        (key) => JSON.stringify(previousPreferences[key]) !== JSON.stringify(preferences[key]),
      );

      await writeAdminAudit(actor, {
        action: "ADMIN_DISPLAY_STUDIO_UPDATED",
        targetType: "DisplayStudioSettings",
        targetId: settings.id,
        metadata: { changedFields },
        reason: "ADMIN_REQUEST",
        outcome: "SUCCEEDED",
      }, tx);

      return settings;
    });

    return NextResponse.json(
      { success: true, preferences: settings.preferences },
      { headers: NO_STORE_HEADERS },
    );
  } catch (cause) {
    reportOperationalFailure("DISPLAY_STUDIO_ADMIN_WRITE_FAILED", { cause });

    return NextResponse.json(
      { error: "Unable to save display settings. Check administrator access." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
