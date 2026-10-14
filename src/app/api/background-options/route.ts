
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Please sign in." },
        { status: 401 }
      );
    }

    const backgrounds = await prisma.backgroundOption.findMany({
      where: { enabled: true },
      select: {
        id: true,
        name: true,
        type: true,
        value: true,
        description: true,
        sortOrder: true,
      },
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({
      success: true,
      backgrounds,
    });
  } catch (error) {
    console.error("Load background options error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load background options.",
      },
      { status: 500 }
    );
  }
}