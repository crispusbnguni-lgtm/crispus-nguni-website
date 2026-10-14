
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/authorization";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export async function GET() {
  try {
    await requireSuperAdmin();

    const settings = await prisma.welcomePageSettings.findUnique({
      where: { key: "main" },
    });

    const storedContent: unknown = settings?.content;

    if (
      !isRecord(storedContent) ||
      !isRecord(storedContent.__cms) ||
      !isRecord(storedContent.__cms.draft)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Save a draft before previewing it.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      content: storedContent.__cms.draft,
    });
  } catch (error) {
    console.error("Unable to load homepage preview content:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load the preview. Check administrator access.",
      },
      { status: 500 },
    );
  }
}