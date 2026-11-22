
import { NextResponse } from "next/server";
import { ConsultationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { recalculateLeadScore } from "@/lib/lead-crm";
import { requireSameOriginApiRequest } from "@/lib/authorization";

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

const allowedTransitions: Record<
  ConsultationStatus,
  readonly ConsultationStatus[]
> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  RESCHEDULED: [],
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
    const originResponse = requireSameOriginApiRequest(request);
    if (originResponse) return originResponse;

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
          leadId: true,
          status: true,
          cancellationReason: true,
          title: true,
          scheduledAt: true,
          durationMinutes: true,
        },
      });

      if (!current) {
        return { kind: "NOT_FOUND" as const };
      }

      if (current.status === newStatus) {
        return { kind: "UNCHANGED" as const };
      }

      if (newStatus === "RESCHEDULED") {
        return { kind: "RESCHEDULE_UNAVAILABLE" as const };
      }

      if (!allowedTransitions[current.status].includes(newStatus)) {
        return { kind: "INVALID_TRANSITION" as const };
      }

      const now = new Date();

      if (newStatus === "NO_SHOW") {
        const scheduledEnd =
          current.scheduledAt.getTime() +
          current.durationMinutes * 60_000;

        if (now.getTime() < scheduledEnd) {
          return { kind: "NO_SHOW_TOO_EARLY" as const };
        }
      }

      const updated = await tx.consultation.updateMany({
        where: {
          id: current.id,
          status: current.status,
        },
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
      });

      // Compare-and-update prevents two concurrent requests from
      // successfully applying transitions from the same old status.
      if (updated.count !== 1) {
        return { kind: "CONFLICT" as const };
      }

      await tx.consultationActivity.create({
        data: {
          consultationId: current.id,
          userId: user.id,
          title:
            newStatus === "CANCELLED"
              ? "Consultation cancelled"
              : newStatus === "NO_SHOW"
                ? "Consultation marked as no-show"
                : newStatus === "COMPLETED"
                  ? "Consultation completed"
                  : "Consultation confirmed",
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

      if (newStatus === "COMPLETED") {
        const existingMeetingActivity = await tx.leadActivity.findFirst({
          where: {
            leadId: current.leadId,
            type: "MEETING",
            metadata: {
              path: ["consultationId"],
              equals: current.id,
            },
          },
          select: { id: true },
        });

        if (!existingMeetingActivity) {
          await tx.leadActivity.create({
            data: {
              leadId: current.leadId,
              userId: user.id,
              type: "MEETING",
              title: "Consultation completed",
              content: current.title,
              metadata: {
                consultationId: current.id,
                source: "CONSULTATION_STATUS",
              },
              createdAt: now,
            },
          });
        }
      }

      await recalculateLeadScore(tx, current.leadId, now);

      return { kind: "UPDATED" as const };
    });

    if (result.kind === "NOT_FOUND") {
      return jsonError("Consultation not found.", 404);
    }

    if (result.kind === "RESCHEDULE_UNAVAILABLE") {
      return jsonError(
        "Use a dedicated rescheduling flow to move this consultation. That workflow is not available yet.",
        409,
      );
    }

    if (result.kind === "INVALID_TRANSITION") {
      return jsonError(
        "This consultation has reached a status from which that transition is not permitted.",
        409,
      );
    }

    if (result.kind === "NO_SHOW_TOO_EARLY") {
      return jsonError(
        "A consultation can only be marked as a no-show after its scheduled end time.",
        409,
      );
    }

    if (result.kind === "CONFLICT") {
      return jsonError(
        "The consultation was updated by another request. Refresh and try again.",
        409,
      );
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
