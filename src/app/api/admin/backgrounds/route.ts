
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function isSuperAdmin() {
  const user = await getCurrentUser();
  return user?.role === "SUPER_ADMIN";
}

export async function GET() {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 403 }
      );
    }

    const backgrounds = await prisma.backgroundOption.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({
      success: true,
      backgrounds,
    });
  } catch (error) {
    console.error("Load backgrounds error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load backgrounds." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";
    const type = body.type;
    const value =
      typeof body.value === "string" ? body.value.trim() : "";
    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    const isDefault = body.isDefault === true;
    const enabled = body.enabled !== false;

    if (!name || name.length > 100) {
      return NextResponse.json(
        { success: false, message: "Enter a name of up to 100 characters." },
        { status: 400 }
      );
    }

    if (type !== "COLOR" && type !== "IMAGE") {
      return NextResponse.json(
        { success: false, message: "Type must be COLOR or IMAGE." },
        { status: 400 }
      );
    }

    if (!value) {
      return NextResponse.json(
        { success: false, message: "A background value is required." },
        { status: 400 }
      );
    }

    if (type === "COLOR" && !/^#[0-9a-fA-F]{6}$/.test(value)) {
      return NextResponse.json(
        { success: false, message: "Use a valid hex color, e.g. #05070D." },
        { status: 400 }
      );
    }

    if (type === "IMAGE") {
      let imageUrl: URL;

      try {
        imageUrl = new URL(value);
      } catch {
        return NextResponse.json(
          { success: false, message: "Enter a valid image URL." },
          { status: 400 }
        );
      }

      if (imageUrl.protocol !== "https:") {
        return NextResponse.json(
          { success: false, message: "Image URLs must use HTTPS." },
          { status: 400 }
        );
      }
    }

    const background = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.backgroundOption.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.backgroundOption.create({
        data: {
          name,
          type,
          value,
          description: description || null,
          enabled,
          isDefault,
        },
      });
    });

    return NextResponse.json(
      { success: true, background },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create background error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to create background." },
      { status: 500 }
    );
  }
}