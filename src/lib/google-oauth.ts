import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Redis } from "@upstash/redis";
import { createRemoteJWKSet, jwtVerify } from "jose";

export type GoogleOAuthIntent = "signin" | "signup" | "link";

type GoogleOAuthTransaction = {
  intent: GoogleOAuthIntent;
  nonce: string;
  codeVerifier: string;
  browserBindingHash: string;
  createdAt: number;
  sessionId?: string;
  userId?: string;
};

export type GoogleOAuthIdentity = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
};

const APP_ORIGIN = "https://crispus-nguni-website.vercel.app";
const CALLBACK_PATH = "/api/auth/google/callback";
const CALLBACK_URI = `${APP_ORIGIN}${CALLBACK_PATH}`;
const TRANSACTION_TTL_SECONDS = 300;
const TRANSACTION_TTL_MS = TRANSACTION_TTL_SECONDS * 1000;
const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
  { timeoutDuration: 5_000 },
);
const BINDING_COOKIE_PREFIX = "google_oauth_binding_";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis =
  redisUrl && redisToken
    ? new Redis({ url: redisUrl, token: redisToken })
    : null;

function getRedis(): Redis {
  if (!redis) throw new Error("OAuth transaction storage is unavailable.");
  return redis;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function randomSecret(): string {
  return randomBytes(32).toString("base64url");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeTransaction(value: unknown): GoogleOAuthTransaction | null {
  let parsed: unknown = value;

  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }

  if (!isRecord(parsed)) return null;

  const intent = parsed.intent;
  const createdAt = parsed.createdAt;
  const nonce = parsed.nonce;
  const codeVerifier = parsed.codeVerifier;
  const browserBindingHash = parsed.browserBindingHash;

  if (
    (intent !== "signin" && intent !== "signup" && intent !== "link") ||
    typeof createdAt !== "number" ||
    !Number.isFinite(createdAt) ||
    typeof nonce !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(nonce) ||
    typeof codeVerifier !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(codeVerifier) ||
    typeof browserBindingHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(browserBindingHash)
  ) {
    return null;
  }

  if (
    intent === "link" &&
    (typeof parsed.sessionId !== "string" ||
      !parsed.sessionId ||
      typeof parsed.userId !== "string" ||
      !parsed.userId)
  ) {
    return null;
  }

  if (
    intent !== "link" &&
    (parsed.sessionId !== undefined || parsed.userId !== undefined)
  ) {
    return null;
  }

  return {
    intent,
    nonce,
    codeVerifier,
    browserBindingHash,
    createdAt,
    ...(intent === "link"
      ? { sessionId: parsed.sessionId as string, userId: parsed.userId as string }
      : {}),
  };
}

function transactionKey(state: string): string {
  return `auth:google:oauth:${sha256(state)}`;
}

export function googleBindingCookieName(state: string): string | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(state)) return null;
  return `${BINDING_COOKIE_PREFIX}${state}`;
}

export function getGoogleOAuthConfiguration() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const appUrlValue = process.env.APP_URL?.trim();

  if (!clientId || !clientSecret || !appUrlValue) {
    throw new Error("Google OAuth configuration is unavailable.");
  }

  let appUrl: URL;
  try {
    appUrl = new URL(appUrlValue);
  } catch {
    throw new Error("Google OAuth configuration is invalid.");
  }

  if (
    appUrl.protocol !== "https:" ||
    appUrl.username ||
    appUrl.password ||
    appUrl.search ||
    appUrl.hash ||
    (appUrl.pathname !== "/" && appUrl.pathname !== "") ||
    appUrl.origin !== APP_ORIGIN
  ) {
    throw new Error("APP_URL does not match the registered Google callback origin.");
  }

  const callbackUri = new URL(CALLBACK_PATH, appUrl).toString();
  if (callbackUri !== CALLBACK_URI) {
    throw new Error("APP_URL does not match the registered Google callback URI.");
  }

  return { clientId, clientSecret, appOrigin: appUrl.origin, callbackUri };
}

export async function createGoogleOAuthTransaction({
  intent,
  session,
}: {
  intent: GoogleOAuthIntent;
  session?: { id: string; userId: string };
}): Promise<{
  state: string;
  bindingCookieName: string;
  bindingSecret: string;
  authorizationUrl: URL;
}> {
  const config = getGoogleOAuthConfiguration();

  if (intent === "link" && (!session?.id || !session.userId)) {
    throw new Error("An authenticated session is required for account linking.");
  }
  if (intent !== "link" && session) {
    throw new Error("Session binding is only valid for account linking.");
  }

  const state = randomSecret();
  const nonce = randomSecret();
  const codeVerifier = randomSecret();
  const bindingSecret = randomSecret();
  const bindingCookieName = googleBindingCookieName(state);
  if (!bindingCookieName) throw new Error("Unable to create OAuth transaction.");

  const transaction: GoogleOAuthTransaction = {
    intent,
    nonce,
    codeVerifier,
    browserBindingHash: sha256(bindingSecret),
    createdAt: Date.now(),
    ...(intent === "link"
      ? { sessionId: session!.id, userId: session!.userId }
      : {}),
  };

  const result = await getRedis().set(
    transactionKey(state),
    JSON.stringify(transaction),
    { ex: TRANSACTION_TTL_SECONDS, nx: true },
  );
  if (result !== "OK") throw new Error("Unable to create OAuth transaction.");

  const challenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const authorizationUrl = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  authorizationUrl.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();

  return { state, bindingCookieName, bindingSecret, authorizationUrl };
}

function bindingMatches(transaction: GoogleOAuthTransaction, secret: string): boolean {
  if (!secret || secret.length > 128) return false;
  const expected = Buffer.from(transaction.browserBindingHash, "hex");
  const actual = Buffer.from(sha256(secret), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function transactionIsFresh(transaction: GoogleOAuthTransaction): boolean {
  const now = Date.now();
  return (
    transaction.createdAt <= now &&
    now - transaction.createdAt <= TRANSACTION_TTL_MS
  );
}

export async function consumeGoogleOAuthTransaction(
  state: string,
  bindingSecret: string,
): Promise<GoogleOAuthTransaction | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(state) || !bindingSecret) return null;

  const redisClient = getRedis();
  const key = transactionKey(state);
  const pending = decodeTransaction(await redisClient.get<unknown>(key));

  // Check the browser secret before consuming so possession of OAuth state
  // alone cannot invalidate another browser's pending transaction.
  if (
    !pending ||
    !transactionIsFresh(pending) ||
    !bindingMatches(pending, bindingSecret)
  ) {
    return null;
  }

  // GETDEL is atomic: only one callback can obtain and complete this record.
  const consumed = decodeTransaction(await redisClient.getdel<unknown>(key));
  if (
    !consumed ||
    !transactionIsFresh(consumed) ||
    !bindingMatches(consumed, bindingSecret) ||
    consumed.intent !== pending.intent ||
    consumed.nonce !== pending.nonce ||
    consumed.codeVerifier !== pending.codeVerifier ||
    consumed.sessionId !== pending.sessionId ||
    consumed.userId !== pending.userId
  ) {
    return null;
  }

  return consumed;
}

export async function exchangeGoogleAuthorizationCode({
  code,
  codeVerifier,
}: {
  code: string;
  codeVerifier: string;
}): Promise<string | null> {
  const config = getGoogleOAuthConfiguration();
  if (!code || code.length > 4096) return null;

  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.callbackUri,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;

  const tokenResponse: unknown = await response.json().catch(() => null);
  if (!isRecord(tokenResponse)) return null;
  return typeof tokenResponse.id_token === "string" &&
    tokenResponse.id_token.length <= 32_768
    ? tokenResponse.id_token
    : null;
}

function isValidEmail(value: string): boolean {
  return (
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) &&
    !/[\r\n\0]/.test(value)
  );
}

export async function verifyGoogleIdToken(
  idToken: string,
  expectedNonce: string,
): Promise<GoogleOAuthIdentity | null> {
  const { clientId } = getGoogleOAuthConfiguration();
  if (!idToken || idToken.length > 32_768) return null;

  try {
    const { payload, protectedHeader } = await jwtVerify(idToken, GOOGLE_JWKS, {
      algorithms: ["RS256"],
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: clientId,
      clockTolerance: 5,
      maxTokenAge: "5m",
    });

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      protectedHeader.alg !== "RS256" ||
      typeof payload.exp !== "number" ||
      typeof payload.iat !== "number" ||
      payload.iat > nowSeconds + 60 ||
      payload.nonce !== expectedNonce ||
      typeof payload.sub !== "string" ||
      !payload.sub.trim() ||
      payload.sub.trim() !== payload.sub ||
      payload.sub.length > 512 ||
      /[\u0000-\u001f\u007f]/.test(payload.sub)
    ) {
      return null;
    }

    if (
      Array.isArray(payload.aud) &&
      payload.aud.length > 1 &&
      payload.azp !== clientId
    ) {
      return null;
    }

    const rawEmail = typeof payload.email === "string" ? payload.email : null;
    const email = rawEmail?.trim().toLowerCase() ?? null;
    const name = typeof payload.name === "string"
      ? payload.name.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 100) || null
      : null;

    return {
      sub: payload.sub,
      email: email && isValidEmail(email) ? email : null,
      emailVerified: payload.email_verified === true,
      name,
    };
  } catch {
    return null;
  }
}

export const GOOGLE_OAUTH_APP_ORIGIN = APP_ORIGIN;
export const GOOGLE_OAUTH_CALLBACK_PATH = CALLBACK_PATH;
