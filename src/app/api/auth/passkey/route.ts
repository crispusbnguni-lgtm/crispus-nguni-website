import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPasskeyRateLimit } from "@/lib/rate-limit";
import { getWebAuthnConfig } from "@/lib/webauthn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ManagementBody = {
  id?: unknown;
  name?: unknown;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

function successResponse(data: Record<string, unknown>) {
  return NextResponse.json(
    { success: true, ...data },
    { headers: { "Cache-Control": "no-store" } }
  );
}

async function enforceMutationSecurity(
  request: Request,
  userId: string
): Promise<NextResponse | null> {
  const origin = request.headers.get("origin");

  if (!origin) {
    return errorResponse("A valid request origin is required.", 403);
  }

  let expectedOrigin: string;

  try {
    expectedOrigin = getWebAuthnConfig().origin;
  } catch {
    return errorResponse("Passkey management is temporarily unavailable.", 503);
  }

  if (origin !== expectedOrigin) {
    return errorResponse("Request origin could not be verified.", 403);
  }

  const contentType = request.headers.get("content-type")?.toLowerCase();

  if (!contentType?.startsWith("application/json")) {
    return errorResponse("Content-Type must be application/json.", 415);
  }

  const rateLimit = await checkPasskeyRateLimit({
    request,
    action: "manage",
    userId,
  });

  if (rateLimit.unavailable) {
    return errorResponse(
      "Passkey management is temporarily unavailable.",
      503
    );
  }

  if (rateLimit.limited) {
    return NextResponse.json(
      {
        success: false,
        message: "Too many passkey management attempts. Please try again later.",
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(rateLimit.retryAfter),
        },
      }
    );
  }

  return null;
}

async function readBody(request: Request): Promise<ManagementBody | null> {
  try {
    const parsed: unknown = await request.json();

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    return parsed as ManagementBody;
  } catch {
    return null;
  }
}

function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= 128
  );
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Please sign in again.", 401);
    }

    const passkeys = await prisma.passkeyCredential.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        deviceType: true,
        backedUp: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });

    return successResponse({ passkeys });
  } catch (error) {
    console.error("List passkeys error:", error);
    return errorResponse("Unable to load your passkeys.", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Please sign in again.", 401);
    }

    const securityError = await enforceMutationSecurity(request, user.id);

    if (securityError) {
      return securityError;
    }

    const body = await readBody(request);

    if (!body || !validId(body.id)) {
      return errorResponse("A valid passkey ID is required.", 400);
    }

    if (
      typeof body.name !== "string" ||
      body.name.trim().length === 0 ||
      body.name.trim().length > 80
    ) {
      return errorResponse(
        "Passkey name must contain between 1 and 80 characters.",
        400
      );
    }

    const id = body.id.trim();
    const name = body.name.trim();

    const existing = await prisma.passkeyCredential.findFirst({
      where: {
        id,
        userId: user.id,
        revokedAt: null,
      },
      select: { id: true },
    });

    if (!existing) {
      return errorResponse("Passkey not found or already revoked.", 404);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.passkeyCredential.updateMany({
        where: {
          id,
          userId: user.id,
          revokedAt: null,
        },
        data: { name },
      });

      if (result.count !== 1) {
        return false;
      }

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "PASSKEY_RENAMED",
          targetType: "PasskeyCredential",
          targetId: id,
          metadata: { name },
        },
      });

      return true;
    });

    if (!updated) {
      return errorResponse(
        "This passkey has changed or has already been revoked. Refresh and try again.",
        409
      );
    }

    return successResponse({
      message: "Passkey renamed successfully.",
    });
  } catch (error) {
    console.error("Rename passkey error:", error);
    return errorResponse("Unable to rename this passkey.", 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Please sign in again.", 401);
    }

    const securityError = await enforceMutationSecurity(request, user.id);

    if (securityError) {
      return securityError;
    }

    const body = await readBody(request);

    if (!body || !validId(body.id)) {
      return errorResponse("A valid passkey ID is required.", 400);
    }

    const id = body.id.trim();

    const existing = await prisma.passkeyCredential.findFirst({
      where: {
        id,
        userId: user.id,
        revokedAt: null,
      },
      select: { id: true },
    });

    if (!existing) {
      return errorResponse("Passkey not found or already revoked.", 404);
    }

    const revoked = await prisma.$transaction(async (tx) => {
      const result = await tx.passkeyCredential.updateMany({
        where: {
          id,
          userId: user.id,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      if (result.count !== 1) {
        return false;
      }

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "PASSKEY_REVOKED",
          targetType: "PasskeyCredential",
          targetId: id,
        },
      });

      return true;
    });

    if (!revoked) {
      return errorResponse(
        "This passkey has already been revoked. Refresh and try again.",
        409
      );
    }

    return successResponse({
      message: "Passkey revoked successfully.",
    });
  } catch (error) {
    console.error("Revoke passkey error:", error);
    return errorResponse("Unable to revoke this passkey.", 500);
  }
}