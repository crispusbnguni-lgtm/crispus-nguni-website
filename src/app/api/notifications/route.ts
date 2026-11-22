import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSameOriginApiRequest } from "@/lib/authorization";
import { reportOperationalFailure } from "@/lib/observability";

export const dynamic = "force-dynamic";
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          link: true,
          metadata: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({
        where: {
          userId: user.id,
          readAt: null,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    }, { headers: NO_STORE_HEADERS });
  } catch (cause) {
    reportOperationalFailure("NOTIFICATIONS_READ_FAILED", { cause });

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load notifications.",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const originResponse = requireSameOriginApiRequest(request);
    if (originResponse) return originResponse;

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("action" in body) ||
      typeof body.action !== "string"
    ) {
      return NextResponse.json(
        { success: false, message: "A valid action is required." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (body.action === "mark-all-read") {
      const result = await prisma.notification.updateMany({
        where: {
          userId: user.id,
          readAt: null,
        },
        data: {
          readAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        updatedCount: result.count,
      }, { headers: NO_STORE_HEADERS });
    }

    if (
      body.action === "mark-read" &&
      "notificationId" in body &&
      typeof body.notificationId === "string" &&
      body.notificationId.trim().length > 0
    ) {
      const result = await prisma.notification.updateMany({
        where: {
          id: body.notificationId,
          userId: user.id,
          readAt: null,
        },
        data: {
          readAt: new Date(),
        },
      });

      if (result.count === 0) {
        const notification = await prisma.notification.findFirst({
          where: {
            id: body.notificationId,
            userId: user.id,
          },
          select: { id: true },
        });

        if (!notification) {
          return NextResponse.json(
            {
              success: false,
              message: "Notification not found.",
            },
            { status: 404, headers: NO_STORE_HEADERS },
          );
        }
      }

      return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
    }

    return NextResponse.json(
      { success: false, message: "Unsupported notification action." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  } catch (cause) {
    reportOperationalFailure("NOTIFICATIONS_UPDATE_FAILED", { cause });

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update notifications.",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
