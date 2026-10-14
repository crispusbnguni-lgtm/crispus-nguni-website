import { NextResponse } from "next/server";
import argon2 from "argon2";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

export async function POST(request: Request) {
try {
const body = await request.json();

const email = String(body.email ?? "").trim().toLowerCase();
const password = String(body.password ?? "");

if (!email || !password) {
  return NextResponse.json(
    {
      success: false,
      message: "Email and password are required.",
    },
    { status: 400 }
  );
}

const user = await prisma.user.findUnique({
  where: { email },
});

if (!user) {
  return NextResponse.json(
    {
      success: false,
      message: "Invalid email or password.",
    },
    { status: 401 }
  );
}

const passwordValid = await argon2.verify(
  user.passwordHash,
  password
);

if (!passwordValid) {
  return NextResponse.json(
    {
      success: false,
      message: "Invalid email or password.",
    },
    { status: 401 }
  );
}

await createSession(user.id);

return NextResponse.json({
  success: true,
  message: "Login successful.",
  user: {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  },
});

} catch (error) {
console.error("Login error:", error);

return NextResponse.json(
  {
    success: false,
    message: "Something went wrong while logging in.",
  },
  { status: 500 }
);

}
}