import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  consumeEmailActionToken,
  createEmailActionToken,
} from "@/lib/email-action-tokens";
import { sendPasswordResetEmail } from "@/lib/auth-email";
import { checkAuthRateLimit } from "@/lib/rate-limit";

const MAX_REQUEST_BYTES = 8 * 1024;

const GENERIC_RESPONSE = {
  success: true,
  message:
    "If an eligible account exists for that email address, password reset instructions will be sent.",
};

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  headers?: Record<string, string>,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | null> {
  const contentLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return null;
  }

  if (!request.body) {
    return null;
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;

      if (totalBytes > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return null;
      }

      chunks.push(value);
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;

    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

function invalidEmailResponse() {
  return jsonResponse(
    {
      success: false,
      message: "Please provide a valid email address.",
    },
    400,
  );
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type");
  const mediaType = contentType?.split(";", 1)[0].trim().toLowerCase();

  if (mediaType !== "application/json") {
    return jsonResponse(
      {
        success: false,
        message: "Content-Type must be application/json.",
      },
      415,
    );
  }

  const body = await readJsonObject(request);

  if (!body) {
    return jsonResponse(
      {
        success: false,
        message: "Invalid request body.",
      },
      400,
    );
  }

  const rawEmail = body.email;

  if (typeof rawEmail !== "string" || rawEmail.length > 254) {
    return invalidEmailResponse();
  }

  const email = rawEmail.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return invalidEmailResponse();
  }

  try {
    const rateLimit = await checkAuthRateLimit({
      request,
      action: "password-reset",
      email,
    });

    if (rateLimit.unavailable) {
      return jsonResponse(
        {
          success: false,
          message:
            "Password reset is temporarily unavailable. Please try again shortly.",
        },
        503,
      );
    }

    if (rateLimit.limited) {
      return jsonResponse(
        {
          success: false,
          message: "Too many requests. Please wait before trying again.",
        },
        429,
        { "Retry-After": String(rateLimit.retryAfter) },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerifiedAt: true,
        identities: {
          where: { provider: "EMAIL" },
          select: {
            providerSubject: true,
            verifiedAt: true,
          },
        },
      },
    });

    if (
      user &&
      user.email === email &&
      user.emailVerifiedAt &&
      (user.identities.length === 0 ||
        user.identities.some(
          (identity) =>
            identity.providerSubject === email &&
            identity.verifiedAt !== null,
        ))
    ) {
      let token: string | null = null;

      try {
        token = await createEmailActionToken({
          userId: user.id,
          purpose: "PASSWORD_RESET",
          expiresInMinutes: 30,
        });

        await sendPasswordResetEmail({
          to: email,
          name: user.name ?? "there",
          token,
        });
      } catch {
        if (token) {
          try {
            await consumeEmailActionToken({
              token,
              purpose: "PASSWORD_RESET",
            });
          } catch {
            console.error("Password-reset token cleanup failed.");
          }
        }

        console.error("Password-reset email processing failed.");
      }
    }

    return jsonResponse(GENERIC_RESPONSE, 200);
  } catch {
    console.error("Password-reset request processing failed.");

    return jsonResponse(
      {
        success: false,
        message:
          "Password reset is temporarily unavailable. Please try again shortly.",
      },
      503,
    );
  }
}
