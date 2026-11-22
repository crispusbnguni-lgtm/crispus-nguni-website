
import "server-only";

import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { phoneOtpRateLimitExceeded } from "@/lib/phone-otp-core";

type AuthAction =
  | "login"
  | "signup"
  | "email-verification"
  | "resend-verification"
  | "magic-link"
  | "magic-link-verify"
  | "password-reset"
  | "password-reset-confirm"
  | "google-start"
  | "google-callback"
  | "phone-signup-send"
  | "phone-signup-verify"
  | "phone-signin-send"
  | "phone-signin-verify";

type RateLimitResult = {
  limited: boolean;
  retryAfter: number;
  unavailable: boolean;
};

export type MfaRateLimitAction = "challenge-verify" | "enrollment" | "recovery";

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

const emailVerificationIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 h"),
      prefix: "auth:email-verification:ip",
      analytics: true,
    })
  : null;

const resendVerificationIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      prefix: "auth:resend-verification:ip",
      analytics: true,
    })
  : null;

const resendVerificationAccountLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "1 h"),
      prefix: "auth:resend-verification:account",
      analytics: true,
    })
  : null;

const magicLinkIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      prefix: "auth:magic-link:ip",
      analytics: true,
    })
  : null;

const magicLinkAccountLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "1 h"),
      prefix: "auth:magic-link:account",
      analytics: true,
    })
  : null;

const magicLinkVerifyIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "10 m"),
      prefix: "auth:magic-link:verify:ip",
      analytics: true,
    })
  : null;

const passwordResetIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      prefix: "auth:password-reset:ip",
      analytics: true,
    })
  : null;

const passwordResetAccountLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "1 h"),
      prefix: "auth:password-reset:account",
      analytics: true,
    })
  : null;

const passwordResetConfirmIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "10 m"),
      prefix: "auth:password-reset:confirm:ip",
      analytics: true,
    })
  : null;

const googleOAuthStartIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "10 m"),
      prefix: "auth:google:start:ip",
      analytics: true,
    })
  : null;

const googleOAuthCallbackIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "10 m"),
      prefix: "auth:google:callback:ip",
      analytics: true,
    })
  : null;

const phoneOtpSendIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 h"),
      prefix: "auth:phone-otp:send:ip",
      analytics: true,
    })
  : null;

const phoneOtpSendPhoneLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "1 h"),
      prefix: "auth:phone-otp:send:phone",
      analytics: true,
    })
  : null;

const phoneOtpVerifyIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "10 m"),
      prefix: "auth:phone-otp:verify:ip",
      analytics: true,
    })
  : null;

const phoneOtpVerifyPhoneLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "10 m"),
      prefix: "auth:phone-otp:verify:phone",
      analytics: true,
    })
  : null;

const leadCreateIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 h"),
      prefix: "crm:lead-create:ip",
      analytics: false,
    })
  : null;

const leadCreateUserLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 h"),
      prefix: "crm:lead-create:user",
      analytics: false,
    })
  : null;

const publicLeadIntakeLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(15, "1 h"),
      prefix: "crm:public-lead:intake:ip",
      analytics: false,
    })
  : null;

const publicConsultationBookingLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 h"),
      prefix: "crm:public-consultation:booking:ip",
      analytics: false,
    })
  : null;

const passkeyRegisterOptionsIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      prefix: "auth:passkey:register:options:ip",
      analytics: true,
    })
  : null;

const passkeyRegisterVerifyIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      prefix: "auth:passkey:register:verify:ip",
      analytics: true,
    })
  : null;

const passkeyRegisterAccountLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      prefix: "auth:passkey:register:account",
      analytics: true,
    })
  : null;

const passkeyLoginOptionsIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "10 m"),
      prefix: "auth:passkey:login:options:ip",
      analytics: true,
    })
  : null;

const passkeyLoginVerifyIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "10 m"),
      prefix: "auth:passkey:login:verify:ip",
      analytics: true,
    })
  : null;

const passkeyManagementIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 h"),
      prefix: "auth:passkey:management:ip",
      analytics: true,
    })
  : null;

const passkeyManagementAccountLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 h"),
      prefix: "auth:passkey:management:account",
      analytics: true,
    })
  : null;

const mfaVerifyIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "10 m"),
      prefix: "auth:mfa:verify:ip",
      analytics: false,
    })
  : null;

const mfaVerifyAccountLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "10 m"),
      prefix: "auth:mfa:verify:account",
      analytics: false,
    })
  : null;

const mfaEnrollmentIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 h"),
      prefix: "auth:mfa:enrollment:ip",
      analytics: false,
    })
  : null;

const mfaEnrollmentAccountLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      prefix: "auth:mfa:enrollment:account",
      analytics: false,
    })
  : null;

const mfaRecoveryIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 h"),
      prefix: "auth:mfa:recovery:ip",
      analytics: false,
    })
  : null;

const mfaRecoveryAccountLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "1 h"),
      prefix: "auth:mfa:recovery:account",
      analytics: false,
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

export async function checkMfaRateLimit({
  request,
  userId,
  action,
}: {
  request: Request;
  userId: string;
  action: MfaRateLimitAction;
}): Promise<RateLimitResult> {
  const unavailable: RateLimitResult = {
    limited: false,
    retryAfter: 0,
    unavailable: true,
  };
  if (typeof userId !== "string" || !userId.trim()) return unavailable;

  const ip = getClientIp(request);
  if (!ip || !redis) return unavailable;

  const [ipLimiter, accountLimiter] = action === "challenge-verify"
    ? [mfaVerifyIpLimiter, mfaVerifyAccountLimiter]
    : action === "enrollment"
      ? [mfaEnrollmentIpLimiter, mfaEnrollmentAccountLimiter]
      : [mfaRecoveryIpLimiter, mfaRecoveryAccountLimiter];
  if (!ipLimiter || !accountLimiter) return unavailable;

  try {
    const [ipResult, accountResult] = await Promise.all([
      ipLimiter.limit(hashIdentifier(ip)),
      accountLimiter.limit(hashIdentifier(userId)),
    ]);
    const resetAt = Math.max(
      ipResult.success ? 0 : ipResult.reset,
      accountResult.success ? 0 : accountResult.reset,
    );
    return {
      limited: !ipResult.success || !accountResult.success,
      retryAfter: resetAt ? Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)) : 0,
      unavailable: false,
    };
  } catch {
    return unavailable;
  }
}

export async function checkLeadCreationRateLimit(
  request: Request,
  userId: string,
): Promise<RateLimitResult> {
  if (!redis || !leadCreateIpLimiter || !leadCreateUserLimiter) {
    return { limited: false, retryAfter: 0, unavailable: true };
  }

  const ip = getClientIp(request);
  if (!ip) return { limited: false, retryAfter: 0, unavailable: true };

  try {
    const [ipResult, userResult] = await Promise.all([
      leadCreateIpLimiter.limit(hashIdentifier(ip)),
      leadCreateUserLimiter.limit(hashIdentifier(userId)),
    ]);
    const retryAt = Math.max(
      ipResult.success ? 0 : ipResult.reset,
      userResult.success ? 0 : userResult.reset,
    );

    return {
      limited: !ipResult.success || !userResult.success,
      retryAfter: retryAt ? Math.max(1, Math.ceil((retryAt - Date.now()) / 1000)) : 0,
      unavailable: false,
    };
  } catch (error) {
    console.error("Lead creation rate limiter unavailable:", error);
    return { limited: false, retryAfter: 0, unavailable: true };
  }
}

export async function checkPublicIntakeRateLimit(
  request: Request,
  action: "lead" | "consultation",
): Promise<RateLimitResult> {
  const limiter = action === "lead"
    ? publicLeadIntakeLimiter
    : publicConsultationBookingLimiter;
  if (!redis || !limiter) {
    return { limited: false, retryAfter: 0, unavailable: true };
  }

  const ip = getClientIp(request);
  if (!ip) return { limited: false, retryAfter: 0, unavailable: true };

  try {
    const result = await limiter.limit(hashIdentifier(ip));
    return {
      limited: !result.success,
      retryAfter: result.success
        ? 0
        : Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
      unavailable: false,
    };
  } catch {
    return { limited: false, retryAfter: 0, unavailable: true };
  }
}

export async function checkAuthRateLimit({
  request,
  action,
  email,
  phone,
}: {
  request: Request;
  action: AuthAction;
  email?: string;
  phone?: string;
}): Promise<RateLimitResult> {
  const unavailable: RateLimitResult = {
    limited: false,
    retryAfter: 0,
    unavailable: true,
  };

  if (
    (action === "resend-verification" ||
      action === "magic-link" ||
      action === "password-reset") &&
    (typeof email !== "string" || !email.trim())
  ) {
    return unavailable;
  }

  const phoneOtpSend =
    action === "phone-signup-send" || action === "phone-signin-send";
  const phoneOtpVerify =
    action === "phone-signup-verify" || action === "phone-signin-verify";

  if (phoneOtpSend && (typeof phone !== "string" || !phone.trim())) {
    return unavailable;
  }

  if (
    !redis ||
    (action === "login" &&
      (!loginIpLimiter || !loginAccountLimiter)) ||
    (action === "signup" && !signupIpLimiter) ||
    (action === "email-verification" && !emailVerificationIpLimiter) ||
    (action === "resend-verification" &&
      (!resendVerificationIpLimiter || !resendVerificationAccountLimiter)) ||
    (action === "magic-link" &&
      (!magicLinkIpLimiter || !magicLinkAccountLimiter)) ||
    (action === "magic-link-verify" && !magicLinkVerifyIpLimiter) ||
    (action === "password-reset" &&
      (!passwordResetIpLimiter || !passwordResetAccountLimiter)) ||
    (action === "password-reset-confirm" && !passwordResetConfirmIpLimiter) ||
    (action === "google-start" && !googleOAuthStartIpLimiter) ||
    (action === "google-callback" && !googleOAuthCallbackIpLimiter) ||
    (phoneOtpSend && (!phoneOtpSendIpLimiter || !phoneOtpSendPhoneLimiter)) ||
    (phoneOtpVerify && !phoneOtpVerifyIpLimiter) ||
    (phoneOtpVerify && phone !== undefined && !phoneOtpVerifyPhoneLimiter)
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
        : action === "signup"
          ? [await signupIpLimiter!.limit(ipKey)]
          : action === "email-verification"
            ? [await emailVerificationIpLimiter!.limit(ipKey)]
            : action === "resend-verification"
              ? await Promise.all([
                  resendVerificationIpLimiter!.limit(ipKey),
                  resendVerificationAccountLimiter!.limit(
                    hashIdentifier(email!.trim().toLowerCase()),
                  ),
                ])
              : action === "magic-link"
                ? await Promise.all([
                    magicLinkIpLimiter!.limit(ipKey),
                    magicLinkAccountLimiter!.limit(
                      hashIdentifier(email!.trim().toLowerCase()),
                    ),
                  ])
                : action === "magic-link-verify"
                  ? [await magicLinkVerifyIpLimiter!.limit(ipKey)]
                  : action === "password-reset"
                    ? await Promise.all([
                        passwordResetIpLimiter!.limit(ipKey),
                        passwordResetAccountLimiter!.limit(
                          hashIdentifier(email!.trim().toLowerCase()),
                        ),
                      ])
                    : action === "password-reset-confirm"
                      ? [await passwordResetConfirmIpLimiter!.limit(ipKey)]
                      : action === "google-start"
                        ? [await googleOAuthStartIpLimiter!.limit(ipKey)]
                        : action === "google-callback"
                          ? [await googleOAuthCallbackIpLimiter!.limit(ipKey)]
                          : phoneOtpSend
                            ? await Promise.all([
                                phoneOtpSendIpLimiter!.limit(ipKey),
                                phoneOtpSendPhoneLimiter!.limit(
                                  hashIdentifier(phone!.trim()),
                                ),
                              ])
                            : await Promise.all([
                                phoneOtpVerifyIpLimiter!.limit(ipKey),
                                ...(phone
                                  ? [
                                      phoneOtpVerifyPhoneLimiter!.limit(
                                        hashIdentifier(phone.trim()),
                                      ),
                                    ]
                                  : []),
                              ]);

    const blocked = results.filter((result) => !result.success);

    if (
      (phoneOtpSend || phoneOtpVerify
        ? phoneOtpRateLimitExceeded(results)
        : blocked.length > 0)
    ) {
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

export async function checkPasskeyRateLimit({
  request,
  action,
  userId,
}: {
  request: Request;
  action:
    | "register-options"
    | "register-verify"
    | "login-options"
    | "login-verify"
    | "manage";
  userId?: string;
}): Promise<RateLimitResult> {
  const unavailable: RateLimitResult = {
    limited: false,
    retryAfter: 0,
    unavailable: true,
  };

  const registration =
    action === "register-options" || action === "register-verify";
  const management = action === "manage";

  if ((registration || management) && (!userId || !userId.trim())) {
    return unavailable;
  }

  if (!redis) {
    return unavailable;
  }

  const ip = getClientIp(request);

  if (!ip) {
    return unavailable;
  }

  const ipKey = hashIdentifier(ip);
  const accountKey = userId ? hashIdentifier(userId) : null;

  const limiter =
    action === "register-options"
      ? passkeyRegisterOptionsIpLimiter
      : action === "register-verify"
        ? passkeyRegisterVerifyIpLimiter
        : action === "login-options"
          ? passkeyLoginOptionsIpLimiter
          : action === "login-verify"
            ? passkeyLoginVerifyIpLimiter
            : passkeyManagementIpLimiter;

  if (
    !limiter ||
    (registration && (!passkeyRegisterAccountLimiter || !accountKey)) ||
    (management && (!passkeyManagementAccountLimiter || !accountKey))
  ) {
    return unavailable;
  }

  try {
    const results =
      action === "register-verify"
        ? await Promise.all([
            limiter.limit(ipKey),
            passkeyRegisterAccountLimiter!.limit(accountKey!),
          ])
        : action === "manage"
          ? await Promise.all([
              limiter.limit(ipKey),
              passkeyManagementAccountLimiter!.limit(accountKey!),
            ])
          : [await limiter.limit(ipKey)];

    const blocked = results.filter((result) => !result.success);

    if (blocked.length > 0) {
      const resetAt = Math.max(...blocked.map((result) => result.reset));

      return {
        limited: true,
        retryAfter: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
        unavailable: false,
      };
    }

    return {
      limited: false,
      retryAfter: 0,
      unavailable: false,
    };
  } catch (error) {
    console.error("Passkey rate limiter unavailable:", error);
    return unavailable;
  }
}
