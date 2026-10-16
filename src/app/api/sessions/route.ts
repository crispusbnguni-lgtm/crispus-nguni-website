
import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentSessionId,
  getCurrentUser,
  logout,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SessionActionBody = {
  action?: unknown;
  sessionId?: unknown;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Please sign in again.", 401);
    }

    const currentSessionId = await getCurrentSessionId();

    if (!currentSessionId) {
      return errorResponse(
        "Your current session could not be identified. Please refresh.",
        401
      );
    }

    const sessions = await prisma.userSession.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActiveAt: "desc" },
      select: {
        id: true,
        deviceLabel: true,
        createdAt: true,
        lastActiveAt: true,
        expiresAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      currentSessionId,
      sessions,
    });
  } catch (error) {
    console.error("List sessions error:", error);
    return errorResponse("Unable to load sessions.", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Please sign in again.", 401);
    }

    const currentSessionId = await getCurrentSessionId();

    if (!currentSessionId) {
      return errorResponse(
        "Your current session could not be identified. Please refresh.",
        401
      );
    }

    const body: unknown = await request.json().catch(() => null);

    if (typeof body !== "object" || body === null) {
      return errorResponse("A valid action is required.", 400);
    }

    const input = body as SessionActionBody;
    const action = input.action;
    const now = new Date();

    // Revoke all other sessions while preserving this device.
    if (action === "revoke-others") {
      const otherSessions = await prisma.userSession.findMany({
        where: {
          userId: user.id,
          id: { not: currentSessionId },
          revokedAt: null,
          expiresAt: { gt: now },
        },
        select: { id: true, deviceLabel: true },
      });

      const result = await prisma.$transaction(async (tx) => {
        const revoked = await tx.userSession.updateMany({
          where: {
            userId: user.id,
            id: { not: currentSessionId },
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: { revokedAt: now },
        });

        if (otherSessions.length > 0) {
          await tx.auditLog.createMany({
            data: otherSessions.map((session) => ({
              actorUserId: user.id,
              action: "SESSION_REVOKED",
              targetType: "UserSession",
              targetId: session.id,
              metadata: {
                reason: "USER_REVOKED_OTHER_SESSIONS",
                deviceLabel: session.deviceLabel ?? "Unknown device",
              },
            })),
          });
        }

        await tx.auditLog.create({
          data: {
            actorUserId: user.id,
            action: "OTHER_SESSIONS_REVOKED",
            targetType: "User",
            targetId: user.id,
            metadata: { revokedCount: revoked.count },
          },
        });

        return revoked.count;
      });

      return NextResponse.json({
        success: true,
        revokedCount: result,
        message:
          result === 0
            ? "No other active sessions were found. This device remains signed in."
            : `Signed out ${result} other session${result === 1 ? "" : "s"}. This device remains signed in.`,
      });
    }

    // Revoke every session, including this device, then clear its cookie.
    if (action === "revoke-all") {
      const activeSessions = await prisma.userSession.findMany({
        where: {
          userId: user.id,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        select: { id: true, deviceLabel: true },
      });

      await prisma.$transaction(async (tx) => {
        await tx.userSession.updateMany({
          where: {
            userId: user.id,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: { revokedAt: now },
        });

        if (activeSessions.length > 0) {
          await tx.auditLog.createMany({
            data: activeSessions.map((session) => ({
              actorUserId: user.id,
              action: "SESSION_REVOKED",
              targetType: "UserSession",
              targetId: session.id,
              metadata: {
                reason: "USER_REVOKED_ALL_SESSIONS",
                deviceLabel: session.deviceLabel ?? "Unknown device",
              },
            })),
          });
        }

        await tx.auditLog.create({
          data: {
            actorUserId: user.id,
            action: "ALL_SESSIONS_REVOKED",
            targetType: "User",
            targetId: user.id,
            metadata: { revokedCount: activeSessions.length },
          },
        });
      });

      // All database revocations are committed before clearing this cookie.
      await logout();

      return NextResponse.json({
        success: true,
        message: "All sessions have been revoked. Please sign in again.",
      });
    }

    // Preserve existing individual-session revocation.
    if (
      typeof input.sessionId !== "string" ||
      input.sessionId.trim().length === 0
    ) {
      return errorResponse("A valid session ID or action is required.", 400);
    }

    const sessionId = input.sessionId.trim();

    if (sessionId === currentSessionId) {
      return errorResponse(
        "You cannot revoke your current session here. Use Log out instead.",
        400
      );
    }

    const session = await prisma.userSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        deviceLabel: true,
      },
    });

    if (!session) {
      return errorResponse(
        "Session not found or already revoked.",
        404
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const revoked = await tx.userSession.updateMany({
        where: {
          id: session.id,
          userId: user.id,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });

      if (revoked.count !== 1) {
        return false;
      }

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "SESSION_REVOKED",
          targetType: "UserSession",
          targetId: session.id,
          metadata: {
            deviceLabel: session.deviceLabel ?? "Unknown device",
          },
        },
      });

      return true;
    });

    if (!result) {
      return errorResponse(
        "This session has already expired or been revoked.",
        409
      );
    }

    return NextResponse.json({
      success: true,
      message: "The selected session has been revoked.",
    });
  } catch (error) {
    console.error("Session action error:", error);
    return errorResponse("Unable to complete the session action.", 500);
  }
}
