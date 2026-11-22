
import { NextResponse } from "next/server";
import { requireApiPermission, requireSameOriginApiRequest } from "@/lib/authorization";
import { resolveAdminAuditActor, writeAdminAudit } from "@/lib/admin-audit";
import {
  isBackgroundWriteConflict,
  lockBackgroundOptionWrites,
} from "@/lib/background-governance";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authorization = await requireApiPermission("CONTENT_MODERATE");
    if (authorization.response) return authorization.response;

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
    const authorization = await requireApiPermission("CONTENT_MODERATE");
    if (authorization.response) return authorization.response;
    const originResponse = requireSameOriginApiRequest(request);
    if (originResponse) return originResponse;

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

    const actor = await resolveAdminAuditActor();
    const background = await prisma.$transaction(async (tx) => {
      await lockBackgroundOptionWrites(tx);

      if (isDefault) {
        await tx.backgroundOption.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      const created = await tx.backgroundOption.create({
        data: {
          name,
          type,
          value,
          description: description || null,
          enabled,
          isDefault,
        },
      });

      await writeAdminAudit(
        actor,
        {
          action: "ADMIN_BACKGROUND_CREATED",
          targetType: "BackgroundOption",
          targetId: created.id,
          metadata: {
            changedFields: [
              "name",
              "type",
              "value",
              "description",
              "enabled",
              "isDefault",
            ],
          },
          reason: "ADMIN_REQUEST",
          outcome: "SUCCEEDED",
        },
        tx,
      );

      return created;
    });

    return NextResponse.json(
      { success: true, background },
      { status: 201 }
    );
  } catch (error) {
    if (isBackgroundWriteConflict(error)) {
      return NextResponse.json(
        { success: false, message: "Background library changed concurrently. Refresh and try again." },
        { status: 409 },
      );
    }

    console.error("Create background error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to create background." },
      { status: 500 }
    );
  }
}
