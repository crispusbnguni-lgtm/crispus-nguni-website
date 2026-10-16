
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireSuperAdmin() {
  const user = await requireUser();

  if (user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return user;
}

export async function requirePortfolioOwner(userId: string) {
  const user = await requireUser();

  if (user.role === "SUPER_ADMIN") {
    return user;
  }

  if (user.id !== userId) {
    redirect("/dashboard");
  }

  return user;
}

/**
 * API authorization: return JSON responses instead of page redirects.
 */
export async function requireApiUser() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        {
          success: false,
          message: "Authentication required.",
        },
        {
          status: 401,
          headers: { "Cache-Control": "no-store" },
        },
      ),
    };
  }

  return { user, response: null };
}

/**
 * API authorization: require the Super Admin role.
 */
export async function requireApiSuperAdmin() {
  const result = await requireApiUser();

  if (result.response) {
    return result;
  }

  if (result.user.role !== "SUPER_ADMIN") {
    return {
      user: null,
      response: NextResponse.json(
        {
          success: false,
          message: "Super Admin access required.",
        },
        {
          status: 403,
          headers: { "Cache-Control": "no-store" },
        },
      ),
    };
  }

  return result;
}
