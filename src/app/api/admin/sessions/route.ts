
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getAdmin() {
  const user = await getCurrentUser();

  if (!user || user.role !== "SUPER_ADMIN") {
    return null;
  }

  return user;
}

export async function GET() {
  try {
    const admin = await getAdmin();

    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Super Admin access required." },
        { status: 403 }
      );
    }

    const sessions = await prisma.userSession.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActiveAt: "desc" },
      take: 100,
      select: {
        id: true,
        userId: true,
        deviceLabel: true,
        createdAt: true,
        lastActiveAt: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      sessions,
    });
  } catch (error) {
    console.error("Admin session list error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load user sessions." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdmin();

    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Super Admin access required." },
        { status: 403 }
      );
    }

    const body: unknown = await request.json().catch(() => null);

    if (
      typeof body !== "object" ||
      body === null ||
      !("sessionId" in body) ||
      typeof body.sessionId !== "string" ||
      body.sessionId.trim().length === 0
    ) {
      return NextResponse.json(
        { success: false, message: "A valid session ID is required." },
        { status: 400 }
      );
    }

    const sessionId = body.sessionId.trim();
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.userSession.findFirst({
        where: {
          id: sessionId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        select: {
          id: true,
          userId: true,
          deviceLabel: true,
        },
      });

      if (!session) {
        return { revoked: false as const };
      }

      const update = await tx.userSession.updateMany({
        where: {
          id: session.id,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          revokedAt: now,
        },
      });

      if (update.count !== 1) {
        return { revoked: false as const };
      }

      await tx.auditLog.create({
        data: {
          actorUserId: admin.id,
          action: "ADMIN_SESSION_REVOKED",
          targetType: "UserSession",
          targetId: session.id,
          metadata: {
            affectedUserId: session.userId,
            deviceLabel: session.deviceLabel ?? "Unknown device",
          },
        },
      });

      return { revoked: true as const };
    });

    if (!result.revoked) {
      return NextResponse.json(
        {
          success: false,
          message: "Session not found, expired, or already revoked.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "The selected user's session has been forcibly logged out.",
    });
  } catch (error) {
    console.error("Admin force logout error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to revoke this session." },
      { status: 500 }
    );
  }
}
