
import { NextResponse } from "next/server";
import { ConsultationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

function accessWhere(user: { id: string; role: string }, id: string) {
  return {
    id,
    ...(user.role === "SUPER_ADMIN"
      ? {}
      : { portfolio: { is: { userId: user.id } } }),
  };
}

const detailInclude = {
  lead: {
    select: { id: true, name: true, email: true, phone: true },
  },
  portfolio: {
    select: { id: true, name: true, slug: true, userId: true },
  },
  consultationType: true,
  activities: {
    orderBy: { createdAt: "desc" as const },
    take: 100,
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  },
};

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return jsonError("Authentication required.", 401);
    }

    const { id } = await params;

    if (!id?.trim()) {
      return jsonError("Consultation ID is required.", 400);
    }

    const consultation = await prisma.consultation.findFirst({
      where: accessWhere(user, id),
      include: detailInclude,
    });

    if (!consultation) {
      return jsonError("Consultation not found.", 404);
    }

    return NextResponse.json({
      success: true,
      consultation,
    });
  } catch (error) {
    console.error("GET /api/consultation/[id] failed:", error);

    return jsonError("Unable to load consultation activity.", 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return jsonError("Authentication required.", 401);
    }

    const { id } = await params;

    if (!id?.trim()) {
      return jsonError("Consultation ID is required.", 400);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON request body.", 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("Invalid request body.", 400);
    }

    const input = body as Record<string, unknown>;
    const requestedStatus = input.status;
    const validStatuses = Object.values(ConsultationStatus);

    if (
      typeof requestedStatus !== "string" ||
      !validStatuses.includes(requestedStatus as ConsultationStatus)
    ) {
      return jsonError("Invalid consultation status.", 400);
    }

    const newStatus = requestedStatus as ConsultationStatus;

    const cancellationReason =
      typeof input.cancellationReason === "string"
        ? input.cancellationReason.trim()
        : "";

    if (newStatus === "CANCELLED" && !cancellationReason) {
      return jsonError("A cancellation reason is required.", 400);
    }

    if (cancellationReason.length > 2000) {
      return jsonError(
        "Cancellation reason must be 2,000 characters or fewer.",
        400,
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.consultation.findFirst({
        where: accessWhere(user, id),
        select: {
          id: true,
          status: true,
          cancellationReason: true,
        },
      });

      if (!current) {
        return { kind: "NOT_FOUND" as const };
      }

      if (current.status === newStatus) {
        return { kind: "UNCHANGED" as const };
      }

      const now = new Date();

      const updated = await tx.consultation.update({
        where: { id: current.id },
        data: {
          status: newStatus,

          ...(newStatus === "CONFIRMED"
            ? { confirmedAt: now }
            : {}),

          ...(newStatus === "COMPLETED"
            ? { completedAt: now }
            : {}),

          ...(newStatus === "CANCELLED"
            ? {
                cancelledAt: now,
                cancellationReason,
              }
            : {}),
        },
        select: {
          id: true,
          status: true,
        },
      });

      await tx.consultationActivity.create({
        data: {
          consultationId: updated.id,
          userId: user.id,
          title:
            newStatus === "CANCELLED"
              ? "Consultation cancelled"
              : "Consultation status updated",
          content:
            newStatus === "CANCELLED"
              ? `Status changed from ${current.status} to CANCELLED. Reason: ${cancellationReason}`
              : `Status changed from ${current.status} to ${newStatus}.`,
          metadata: {
            source: "DASHBOARD",
            previousStatus: current.status,
            newStatus,
            ...(newStatus === "CANCELLED"
              ? { cancellationReason }
              : {}),
          },
        },
      });

      return { kind: "UPDATED" as const };
    });

    if (result.kind === "NOT_FOUND") {
      return jsonError("Consultation not found.", 404);
    }

    const consultation = await prisma.consultation.findFirst({
      where: accessWhere(user, id),
      include: detailInclude,
    });

    if (!consultation) {
      return jsonError("Consultation not found.", 404);
    }

    return NextResponse.json({
      success: true,
      message:
        result.kind === "UNCHANGED"
          ? "Consultation status is unchanged."
          : "Consultation status updated successfully.",
      consultation,
    });
  } catch (error) {
    console.error("PATCH /api/consultation/[id] failed:", error);

    return jsonError("Unable to update consultation status.", 500);
  }
}