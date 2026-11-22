import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_DISPLAY_STUDIO_PREFERENCES,
  sanitizeDisplayStudioPreferences,
} from "@/lib/display-studio-preferences";
import { reportOperationalFailure } from "@/lib/observability";

export const dynamic = "force-dynamic";

/** Global appearance defaults are public presentation settings, not account data. */
export async function GET() {
  try {
    const settings = await prisma.displayStudioSettings.findUnique({
      where: { id: "main" },
      select: { preferences: true },
    });

    return NextResponse.json(
      {
        configured: Boolean(settings),
        preferences: settings
          ? sanitizeDisplayStudioPreferences(settings.preferences)
          : DEFAULT_DISPLAY_STUDIO_PREFERENCES,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    reportOperationalFailure("DISPLAY_STUDIO_DEFAULTS_READ_FAILED", { cause });
    return NextResponse.json(
      { error: "Display settings are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
