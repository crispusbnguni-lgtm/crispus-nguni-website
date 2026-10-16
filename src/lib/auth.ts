
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { prisma } from "./prisma";

const secret = process.env.AUTH_SECRET;

if (!secret) {
  throw new Error("AUTH_SECRET is not configured.");
}

const secretKey = new TextEncoder().encode(secret);

const SESSION_COOKIE = "portfolio_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
const ACTIVITY_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

function getDeviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  let browser = "Browser";
  let operatingSystem = "Unknown OS";

  if (/Edg\//i.test(userAgent)) {
    browser = "Microsoft Edge";
  } else if (/OPR\/|Opera/i.test(userAgent)) {
    browser = "Opera";
  } else if (/Chrome\//i.test(userAgent) && !/Chromium/i.test(userAgent)) {
    browser = "Chrome";
  } else if (/Firefox\//i.test(userAgent)) {
    browser = "Firefox";
  } else if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) {
    browser = "Safari";
  }

  if (/Windows/i.test(userAgent)) {
    operatingSystem = "Windows";
  } else if (/Android/i.test(userAgent)) {
    operatingSystem = "Android";
  } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
    operatingSystem = "iOS";
  } else if (/Mac OS X|Macintosh/i.test(userAgent)) {
    operatingSystem = "macOS";
  } else if (/Linux/i.test(userAgent)) {
    operatingSystem = "Linux";
  }

  return `${browser} on ${operatingSystem}`;
}

export async function createSession(
  userId: string,
  request?: Request
) {
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + SESSION_DURATION_SECONDS * 1000
  );

  const userAgent = request?.headers.get("user-agent") ?? null;

  const session = await prisma.userSession.create({
    data: {
      userId,
      deviceLabel: getDeviceLabel(userAgent),
      userAgent: userAgent?.slice(0, 500) ?? null,
      lastActiveAt: now,
      expiresAt,
    },
  });

  try {
    const token = await new SignJWT({
      userId,
      sid: session.id,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(secretKey);

    const cookieStore = await cookies();

    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_SECONDS,
    });
  } catch (error) {
    await prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    throw error;
  }
}

export async function getCurrentSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey, {
  algorithms: ["HS256"],
});

    if (
      typeof payload.userId !== "string" ||
      typeof payload.sid !== "string"
    ) {
      return null;
    }

    const session = await prisma.userSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    return session?.id ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey, {
  algorithms: ["HS256"],
});

    if (
      typeof payload.userId !== "string" ||
      typeof payload.sid !== "string"
    ) {
      return null;
    }

    const now = new Date();

    const session = await prisma.userSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        lastActiveAt: true,
      },
    });

    // A missing, expired, or revoked session cannot authenticate.
    if (!session) return null;

    // Update activity at most once every five minutes.
    if (
      now.getTime() - session.lastActiveAt.getTime() >=
      ACTIVITY_UPDATE_INTERVAL_MS
    ) {
      await prisma.userSession.updateMany({
        where: {
          id: session.id,
          userId: payload.userId,
          revokedAt: null,
          expiresAt: { gt: now },
          lastActiveAt: {
            lt: new Date(
              now.getTime() - ACTIVITY_UPDATE_INTERVAL_MS
            ),
          },
        },
        data: { lastActiveAt: now },
      });
    }

    return await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { portfolioSite: true },
    });
  } catch {
    // Invalid tokens and database errors fail closed.
    return null;
  }
}

export async function logout() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    cookieStore.delete(SESSION_COOKIE);
    return;
  }

  let payload;

  try {
    const verified = await jwtVerify(token, secretKey);
    payload = verified.payload;
  } catch {
    cookieStore.delete(SESSION_COOKIE);
    return;
  }

  if (
    typeof payload.userId !== "string" ||
    typeof payload.sid !== "string"
  ) {
    cookieStore.delete(SESSION_COOKIE);
    return;
  }

  await prisma.userSession.updateMany({
    where: {
      id: payload.sid,
      userId: payload.userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  cookieStore.delete(SESSION_COOKIE);
}
