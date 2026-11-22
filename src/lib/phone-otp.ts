import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { Redis } from "@upstash/redis";
import {
  isPhoneChallengeFresh,
  PHONE_OTP_TTL_SECONDS,
  type PhoneOtpChallenge,
  type PhoneOtpIntent,
} from "@/lib/phone-otp-core";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis =
  redisUrl && redisToken
    ? new Redis({ url: redisUrl, token: redisToken })
    : null;

function challengeKey(id: string) {
  const digest = createHash("sha256").update(id).digest("hex");
  return `auth:phone-otp:challenge:${digest}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function decodeChallenge(value: unknown): PhoneOtpChallenge | null {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!isRecord(value)) return null;

  if (
    (value.intent !== "signup" && value.intent !== "signin") ||
    typeof value.phone !== "string" ||
    typeof value.eligible !== "boolean" ||
    typeof value.createdAt !== "number" ||
    (value.name !== undefined && typeof value.name !== "string")
  ) {
    return null;
  }

  return value as PhoneOtpChallenge;
}

function getRedis() {
  if (!redis) throw new Error("Phone authentication storage is unavailable.");
  return redis;
}

export async function createPhoneOtpChallenge(
  challenge: Omit<PhoneOtpChallenge, "createdAt">,
): Promise<string> {
  const id = randomBytes(32).toString("base64url");
  const value: PhoneOtpChallenge = { ...challenge, createdAt: Date.now() };
  const stored = await getRedis().set(challengeKey(id), JSON.stringify(value), {
    ex: PHONE_OTP_TTL_SECONDS,
    nx: true,
  });
  if (stored !== "OK") throw new Error("Unable to create phone challenge.");
  return id;
}

export async function getPhoneOtpChallenge(
  id: string,
): Promise<PhoneOtpChallenge | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(id)) return null;
  const challenge = decodeChallenge(await getRedis().get<unknown>(challengeKey(id)));
  return challenge && isPhoneChallengeFresh(challenge) ? challenge : null;
}

export async function consumePhoneOtpChallenge(
  id: string,
  intent: PhoneOtpIntent,
): Promise<PhoneOtpChallenge | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(id)) return null;
  const challenge = decodeChallenge(
    await getRedis().getdel<unknown>(challengeKey(id)),
  );
  if (
    !challenge ||
    challenge.intent !== intent ||
    !isPhoneChallengeFresh(challenge)
  ) {
    return null;
  }
  return challenge;
}

export async function deletePhoneOtpChallenge(id: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(id)) return;
  await getRedis().del(challengeKey(id));
}
