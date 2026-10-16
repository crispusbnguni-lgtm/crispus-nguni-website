
import "server-only";

import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

type AuthAction = "login" | "signup";

type RateLimitResult = {
  limited: boolean;
  retryAfter: number;
  unavailable: boolean;
};

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : null;

const loginIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "10 m"),
      prefix: "auth:login:ip",
      analytics: true,
    })
  : null;

const loginAccountLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      prefix: "auth:login:account",
      analytics: true,
    })
  : null;

const signupIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      prefix: "auth:signup:ip",
      analytics: true,
    })
  : null;

function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function getClientIp(request: Request): string | null {
  // Vercel supplies these headers in its deployment environment.
  // Do not trust client-supplied forwarding headers on an arbitrary proxy.
  const realIp = request.headers.get("x-real-ip")?.trim();

  if (realIp && realIp.length <= 100) {
    return realIp;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();

    if (firstIp && firstIp.length <= 100) {
      return firstIp;
    }
  }

  return null;
}

export async function checkAuthRateLimit({
  request,
  action,
  email,
}: {
  request: Request;
  action: AuthAction;
  email?: string;
}): Promise<RateLimitResult> {
  const unavailable: RateLimitResult = {
    limited: false,
    retryAfter: 0,
    unavailable: true,
  };

  if (
    !redis ||
    (action === "login" &&
      (!loginIpLimiter || !loginAccountLimiter)) ||
    (action === "signup" && !signupIpLimiter)
  ) {
    return unavailable;
  }

  const ip = getClientIp(request);

  // If the deployment cannot identify the requester, do not silently
  // allow an unprotected authentication attempt.
  if (!ip) {
    return unavailable;
  }

  try {
    const ipKey = hashIdentifier(ip);

    const results =
      action === "login"
        ? await Promise.all([
            loginIpLimiter!.limit(ipKey),
            ...(email
              ? [
                  loginAccountLimiter!.limit(
                    hashIdentifier(email.trim().toLowerCase()),
                  ),
                ]
              : []),
          ])
        : [await signupIpLimiter!.limit(ipKey)];

    const blocked = results.filter((result) => !result.success);

    if (blocked.length > 0) {
      const resetAt = Math.max(...blocked.map((result) => result.reset));

      return {
        limited: true,
        retryAfter: Math.max(
          1,
          Math.ceil((resetAt - Date.now()) / 1000),
        ),
        unavailable: false,
      };
    }

    return {
      limited: false,
      retryAfter: 0,
      unavailable: false,
    };
  } catch (error) {
    console.error("Authentication rate limiter unavailable:", error);
    return unavailable;
  }
}
