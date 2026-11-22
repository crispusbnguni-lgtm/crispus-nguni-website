import argon2 from "argon2";
import { NextResponse } from "next/server";
import { resetPasswordWithEmailActionToken } from "@/lib/email-action-tokens";
import { checkAuthRateLimit } from "@/lib/rate-limit";

const MAX_REQUEST_BYTES = 8 * 1024;

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

function invalidTokenResponse() {
  return jsonResponse(
    {
      success: false,
      message:
        "This password reset link is invalid or has expired. Request a new password reset if necessary.",
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

  try {
    const rateLimit = await checkAuthRateLimit({
      request,
      action: "password-reset-confirm",
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
          message: "Too many attempts. Please try again later.",
        },
        429,
        { "Retry-After": String(rateLimit.retryAfter) },
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

    const token = body.token;
    const password = typeof body.password === "string" ? body.password : "";

    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return invalidTokenResponse();
    }

    if (!password || password.length < 8 || password.length > 1024) {
      return jsonResponse(
        {
          success: false,
          message: "Password must be between 8 and 1024 characters.",
        },
        400,
      );
    }

    const passwordHash = await argon2.hash(password);
    const reset = await resetPasswordWithEmailActionToken({
      token,
      passwordHash,
    });

    if (!reset) {
      return invalidTokenResponse();
    }

    return jsonResponse(
      {
        success: true,
        message: "Password reset successfully. Please sign in with your new password.",
      },
      200,
    );
  } catch {
    console.error("Password-reset confirmation processing failed.");

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
