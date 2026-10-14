
import { NextResponse } from "next/server";
import { draftMode } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/authorization";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export async function GET(request: Request) {
  try {
    await requireSuperAdmin();

    const settings = await prisma.welcomePageSettings.findUnique({
      where: { key: "main" },
    });

    const storedContent = settings?.content;

    if (!isRecord(storedContent) || !isRecord(storedContent.__cms)) {
      return NextResponse.json(
        { success: false, message: "No saved draft is available to preview." },
        { status: 404 },
      );
    }

    if (!isRecord(storedContent.__cms.draft)) {
      return NextResponse.json(
        { success: false, message: "Save a draft before previewing it." },
        { status: 404 },
      );
    }

    const draft = await draftMode();
    draft.enable();

return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    console.error("Unable to start homepage preview:", error);

    return NextResponse.json(
      { success: false, message: "Unable to open preview. Check your administrator access." },
      { status: 500 },
    );
  }
}