
import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  hasPermission,
  isSuperAdmin,
  type AdminPermission,
} from "@/lib/admin-permissions";

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireSuperAdmin() {
  const user = await requireUser();

  if (!isSuperAdmin(user)) {
    redirect("/dashboard");
  }

  return user;
}

/** Requires a permission for a server-rendered page. */
export async function requirePermission(permission: AdminPermission) {
  const user = await requireUser();

  if (!hasPermission(user, permission)) {
    redirect("/dashboard");
  }

  return user;
}

export async function requirePortfolioOwner(userId: string) {
  const user = await requireUser();

  if (isSuperAdmin(user)) {
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

/** Reject browser-originated privileged mutations unless Origin exactly matches the request origin. */
export function requireSameOriginApiRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return NextResponse.json(
      { success: false, message: "Same-origin request required." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const parsedOrigin = new URL(origin);
    if (
      parsedOrigin.origin === origin &&
      parsedOrigin.origin === new URL(request.url).origin
    ) return null;
  } catch {
    // Invalid Origin or request URLs fail closed.
  }

  return NextResponse.json(
    { success: false, message: "Same-origin request required." },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * API authorization: require the Super Admin role.
 */
export async function requireApiSuperAdmin() {
  const result = await requireApiUser();

  if (result.response) {
    return result;
  }

  if (!isSuperAdmin(result.user)) {
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

/** API authorization: require a specific application permission. */
export async function requireApiPermission(permission: AdminPermission) {
  return requireApiPermissionWithMessage(permission, "Permission required.");
}

async function requireApiPermissionWithMessage(
  permission: AdminPermission,
  deniedMessage: string,
) {
  const result = await requireApiUser();

  if (result.response) {
    return result;
  }

  if (!hasPermission(result.user, permission)) {
    return {
      user: null,
      response: NextResponse.json(
        {
          success: false,
          message: deniedMessage,
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
