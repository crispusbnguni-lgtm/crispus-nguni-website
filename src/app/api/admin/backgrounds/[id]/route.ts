import { NextResponse } from "next/server";
import { resolveAdminAuditActor, writeAdminAudit } from "@/lib/admin-audit";
import { requireApiPermission, requireSameOriginApiRequest } from "@/lib/authorization";
import {
  isBackgroundWriteConflict,
  lockBackgroundOptionWrites,
} from "@/lib/background-governance";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  try {
    const authorization = await requireApiPermission("CONTENT_MODERATE");
    if (authorization.response) return authorization.response;
    const originResponse = requireSameOriginApiRequest(request);
    if (originResponse) return originResponse;

    const { id } = await params;
    const body = await request.json();
    const actor = await resolveAdminAuditActor();

    const result = await prisma.$transaction(async (tx) => {
      await lockBackgroundOptionWrites(tx);

      const existing = await tx.backgroundOption.findUnique({ where: { id } });
      if (!existing) return { kind: "not-found" as const };

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
          return {
            kind: "invalid" as const,
            response: NextResponse.json(
              { success: false, message: "Enter a valid name (up to 100 characters)." },
              { status: 400 },
            ),
          };
        }
        data.name = body.name.trim();
      }

      if (body.type !== undefined) {
        if (body.type !== "COLOR" && body.type !== "IMAGE") {
          return {
            kind: "invalid" as const,
            response: NextResponse.json(
              { success: false, message: "Type must be COLOR or IMAGE." },
              { status: 400 },
            ),
          };
        }
        data.type = body.type;
      }

      if (body.value !== undefined) {
        if (typeof body.value !== "string" || !body.value.trim()) {
          return {
            kind: "invalid" as const,
            response: NextResponse.json(
              { success: false, message: "A background value is required." },
              { status: 400 },
            ),
          };
        }
        data.value = body.value.trim();
      }

      const finalType = data.type ?? existing.type;
      const finalValue = data.value ?? existing.value;

      if (finalType === "COLOR" && !/^#[0-9a-fA-F]{6}$/.test(finalValue)) {
        return {
          kind: "invalid" as const,
          response: NextResponse.json(
            { success: false, message: "Use a valid hex color such as #05070D." },
            { status: 400 },
          ),
        };
      }

      if (finalType === "IMAGE") {
        try {
          const imageUrl = new URL(finalValue);
          if (imageUrl.protocol !== "https:") throw new Error("HTTPS required");
        } catch {
          return {
            kind: "invalid" as const,
            response: NextResponse.json(
              { success: false, message: "Enter a valid HTTPS image URL." },
              { status: 400 },
            ),
          };
        }
      }

      if (body.description !== undefined) {
        if (body.description !== null && typeof body.description !== "string") {
          return {
            kind: "invalid" as const,
            response: NextResponse.json(
              { success: false, message: "Invalid description." },
              { status: 400 },
            ),
          };
        }
        data.description =
          typeof body.description === "string"
            ? body.description.trim() || null
            : null;
      }

      if (body.enabled !== undefined) {
        if (typeof body.enabled !== "boolean") {
          return {
            kind: "invalid" as const,
            response: NextResponse.json(
              { success: false, message: "Enabled must be true or false." },
              { status: 400 },
            ),
          };
        }
        data.enabled = body.enabled;

        if (body.enabled === false && existing.isDefault) {
          return {
            kind: "invalid" as const,
            response: NextResponse.json(
              {
                success: false,
                message: "Set another background as default before disabling this one.",
              },
              { status: 400 },
            ),
          };
        }
      }

      if (body.sortOrder !== undefined) {
        if (!Number.isInteger(body.sortOrder) || body.sortOrder < 0) {
          return {
            kind: "invalid" as const,
            response: NextResponse.json(
              { success: false, message: "Sort order must be a non-negative integer." },
              { status: 400 },
            ),
          };
        }
        data.sortOrder = body.sortOrder;
      }

      if (body.isDefault !== undefined) {
        if (typeof body.isDefault !== "boolean") {
          return {
            kind: "invalid" as const,
            response: NextResponse.json(
              { success: false, message: "isDefault must be true or false." },
              { status: 400 },
            ),
          };
        }

        if (body.isDefault && data.enabled === false) {
          return {
            kind: "invalid" as const,
            response: NextResponse.json(
              { success: false, message: "A disabled background cannot be the default." },
              { status: 400 },
            ),
          };
        }

        if (body.isDefault && existing.enabled === false && data.enabled !== true) {
          return {
            kind: "invalid" as const,
            response: NextResponse.json(
              { success: false, message: "Enable this background before making it the default." },
              { status: 400 },
            ),
          };
        }

        data.isDefault = body.isDefault;
      }

      if (data.isDefault === true) {
        await tx.backgroundOption.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      const updated = await tx.backgroundOption.update({ where: { id }, data });
      await writeAdminAudit(
        actor,
        {
          action: "ADMIN_BACKGROUND_UPDATED",
          targetType: "BackgroundOption",
          targetId: updated.id,
          metadata: { changedFields: Object.keys(data) },
          reason: "ADMIN_REQUEST",
          outcome: "SUCCEEDED",
        },
        tx,
      );

      return { kind: "updated" as const, background: updated };
    });

    if (result.kind === "not-found") {
      return NextResponse.json(
        { success: false, message: "Background not found." },
        { status: 404 },
      );
    }
    if (result.kind === "invalid") return result.response;

    return NextResponse.json({ success: true, background: result.background });
  } catch (error) {
    if (isBackgroundWriteConflict(error)) {
      return NextResponse.json(
        { success: false, message: "Background library changed concurrently. Refresh and try again." },
        { status: 409 },
      );
    }

    console.error("Update background error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to update background." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: RouteContext,
) {
  try {
    const authorization = await requireApiPermission("CONTENT_MODERATE");
    if (authorization.response) return authorization.response;
    const originResponse = requireSameOriginApiRequest(request);
    if (originResponse) return originResponse;

    const { id } = await params;
    const actor = await resolveAdminAuditActor();

    const result = await prisma.$transaction(async (tx) => {
      await lockBackgroundOptionWrites(tx);

      const existing = await tx.backgroundOption.findUnique({ where: { id } });
      if (!existing) return { kind: "not-found" as const };
      if (existing.isDefault) return { kind: "default" as const };

      await tx.backgroundOption.delete({ where: { id } });
      await writeAdminAudit(
        actor,
        {
          action: "ADMIN_BACKGROUND_DELETED",
          targetType: "BackgroundOption",
          targetId: existing.id,
          reason: "ADMIN_REQUEST",
          outcome: "SUCCEEDED",
        },
        tx,
      );

      return { kind: "deleted" as const };
    });

    if (result.kind === "not-found") {
      return NextResponse.json(
        { success: false, message: "Background not found." },
        { status: 404 },
      );
    }
    if (result.kind === "default") {
      return NextResponse.json(
        {
          success: false,
          message: "Choose another default background before deleting this one.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isBackgroundWriteConflict(error)) {
      return NextResponse.json(
        { success: false, message: "Background library changed concurrently. Refresh and try again." },
        { status: 409 },
      );
    }

    console.error("Delete background error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to delete background." },
      { status: 500 },
    );
  }
}
