import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { prisma } from "./prisma";

const secret = process.env.AUTH_SECRET;

if (!secret) {
throw new Error("AUTH_SECRET is not configured.");
}

const secretKey = new TextEncoder().encode(secret);

export async function createSession(userId: string) {
const token = await new SignJWT({ userId })
.setProtectedHeader({ alg: "HS256" })
.setIssuedAt()
.setExpirationTime("7d")
.sign(secretKey);

const cookieStore = await cookies();

cookieStore.set("portfolio_session", token, {
httpOnly: true,
secure: process.env.NODE_ENV === "production",
sameSite: "lax",
path: "/",
maxAge: 60 * 60 * 24 * 7,
});
}

export async function getCurrentUser() {
const cookieStore = await cookies();
const token = cookieStore.get("portfolio_session")?.value;

if (!token) {
return null;
}

try {
const { payload } = await jwtVerify(token, secretKey);

if (typeof payload.userId !== "string") {
  return null;
}

return await prisma.user.findUnique({
  where: {
    id: payload.userId,
  },
  include: {
    portfolioSite: true,
  },
});

} catch {
return null;
}
}

export async function logout() {
const cookieStore = await cookies();

cookieStore.delete("portfolio_session");
}