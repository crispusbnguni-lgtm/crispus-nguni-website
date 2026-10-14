
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function isSuperAdmin() {
  const user = await getCurrentUser();
  return user?.role === "SUPER_ADMIN";
}

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.backgroundOption.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Background not found." },
        { status: 404 }
      );
    }

    const data: {
      name?: string;
      type?: string;
      value?: string;
      description?: string | null;
      enabled?: boolean;
      isDefault?: boolean;
      sortOrder?: number;
    } = {};

    if (body.name !== undefined) {
      if (
        typeof body.name !== "string" ||
        !body.name.trim() ||
        body.name.trim().length > 100
      ) {
        return NextResponse.json(
          { success: false, message: "Enter a valid name (up to 100 characters)." },
          { status: 400 }
        );
      }
      data.name = body.name.trim();
    }

    if (body.type !== undefined) {
      if (body.type !== "COLOR" && body.type !== "IMAGE") {
        return NextResponse.json(
          { success: false, message: "Type must be COLOR or IMAGE." },
          { status: 400 }
        );
      }
      data.type = body.type;
    }

    if (body.value !== undefined) {
      if (typeof body.value !== "string" || !body.value.trim()) {
        return NextResponse.json(
          { success: false, message: "A background value is required." },
          { status: 400 }
        );
      }
      data.value = body.value.trim();
    }

    const finalType = data.type ?? existing.type;
    const finalValue = data.value ?? existing.value;

    if (
      finalType === "COLOR" &&
      !/^#[0-9a-fA-F]{6}$/.test(finalValue)
    ) {
      return NextResponse.json(
        { success: false, message: "Use a valid hex color such as #05070D." },
        { status: 400 }
      );
    }

    if (finalType === "IMAGE") {
      try {
        const imageUrl = new URL(finalValue);
        if (imageUrl.protocol !== "https:") {
          throw new Error("HTTPS required");
        }
      } catch {
        return NextResponse.json(
          { success: false, message: "Enter a valid HTTPS image URL." },
          { status: 400 }
        );
      }
    }

    if (body.description !== undefined) {
      if (
        body.description !== null &&
        typeof body.description !== "string"
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid description." },
          { status: 400 }
        );
      }
      data.description =
        typeof body.description === "string"
          ? body.description.trim() || null
          : null;
    }

    if (body.enabled !== undefined) {
      if (typeof body.enabled !== "boolean") {
        return NextResponse.json(
          { success: false, message: "Enabled must be true or false." },
          { status: 400 }
        );
      }
      data.enabled = body.enabled;

      if (body.enabled === false && existing.isDefault) {
        return NextResponse.json(
          {
            success: false,
            message: "Set another background as default before disabling this one.",
          },
          { status: 400 }
        );
      }
    }

    if (body.sortOrder !== undefined) {
      if (
        !Number.isInteger(body.sortOrder) ||
        body.sortOrder < 0
      ) {
        return NextResponse.json(
          { success: false, message: "Sort order must be a non-negative integer." },
          { status: 400 }
        );
      }
      data.sortOrder = body.sortOrder;
    }

    if (body.isDefault !== undefined) {
      if (typeof body.isDefault !== "boolean") {
        return NextResponse.json(
          { success: false, message: "isDefault must be true or false." },
          { status: 400 }
        );
      }

      if (body.isDefault && data.enabled === false) {
        return NextResponse.json(
          { success: false, message: "A disabled background cannot be the default." },
          { status: 400 }
        );
      }

      if (body.isDefault && existing.enabled === false && data.enabled !== true) {
        return NextResponse.json(
          { success: false, message: "Enable this background before making it the default." },
          { status: 400 }
        );
      }

      data.isDefault = body.isDefault;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (data.isDefault === true) {
        await tx.backgroundOption.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      return tx.backgroundOption.update({
        where: { id },
        data,
      });
    });

    return NextResponse.json({
      success: true,
      background: updated,
    });
  } catch (error) {
    console.error("Update background error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to update background." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext
) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existing = await prisma.backgroundOption.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Background not found." },
        { status: 404 }
      );
    }

    if (existing.isDefault) {
      return NextResponse.json(
        {
          success: false,
          message: "Choose another default background before deleting this one.",
        },
        { status: 400 }
      );
    }

    await prisma.backgroundOption.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete background error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to delete background." },
      { status: 500 }
    );
  }
}