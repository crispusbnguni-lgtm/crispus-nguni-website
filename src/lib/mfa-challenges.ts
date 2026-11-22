import "server-only";

import { Redis } from "@upstash/redis";
import {
  createMfaChallengeService,
  type MfaChallengeStore,
} from "@/lib/mfa-challenges-core";

const RECORD_FAILED_ATTEMPT_LUA = `
if redis.call('EXISTS', KEYS[1]) == 0 then
  return -1
end
local attempts = redis.call('INCR', KEYS[2])
if attempts == 1 then
  redis.call('EXPIRE', KEYS[2], tonumber(ARGV[1]))
end
if attempts >= tonumber(ARGV[2]) then
  redis.call('GETDEL', KEYS[1])
  redis.call('DEL', KEYS[2])
  return 0
end
return tonumber(ARGV[2]) - attempts
`;

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  redisUrl && redisToken
    ? new Redis({ url: redisUrl, token: redisToken })
    : null;

const store: MfaChallengeStore | null = redis
  ? {
      set: (key, value, options) => redis.set(key, value, options),
      get: (key) => redis.get<unknown>(key),
      getdel: (key) => redis.getdel<unknown>(key),
    del: (key) => redis.del(key),
    recordFailedAttempt: async (challengeKey, attemptsKey, ttlSeconds, maxAttempts) => {
      return redis.eval<[number, number], number>(
        RECORD_FAILED_ATTEMPT_LUA,
        [challengeKey, attemptsKey],
        [ttlSeconds, maxAttempts],
      );
    },
    }
  : null;

const service = createMfaChallengeService(store);

export const createPendingMfaChallenge = service.createPendingMfaChallenge;
export const getPendingMfaChallenge = service.getPendingMfaChallenge;
export const consumePendingMfaChallenge = service.consumePendingMfaChallenge;
export const recordFailedMfaAttempt = service.recordFailedMfaAttempt;

export type {
  CreatedMfaChallenge,
  MfaPrimaryAuthMethod,
  PendingMfaChallenge,
  MfaChallengePurpose,
} from "@/lib/mfa-challenges-core";
