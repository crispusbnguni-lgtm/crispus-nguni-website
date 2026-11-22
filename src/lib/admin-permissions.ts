import "server-only";

export const ADMIN_PERMISSIONS = [
  "ACCOUNT_VIEW",
  "ACCOUNT_VERIFY",
  "ACCOUNT_SUSPEND",
  "ACCOUNT_BAN",
  "ACCOUNT_REINSTATE",
  "SESSION_VIEW",
  "SESSION_REVOKE",
  "ROLE_VIEW",
  "ROLE_ASSIGN",
  "ROLE_REVOKE",
  "AUDIT_VIEW",
  "CONTENT_MODERATE",
  "CMS_MANAGE",
  "CRM_MANAGE",
  "ANALYTICS_VIEW",
  "SYSTEM_CONFIGURE",
  "PRIVACY_MANAGE",
  "BACKUP_MANAGE",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

type PermissionPrincipal = {
  role?: unknown;
} | null | undefined;

const knownPermissions: ReadonlySet<string> = new Set(ADMIN_PERMISSIONS);

/**
 * Evaluates an application permission using a principal resolved by trusted
 * server-side authentication code. Browser-provided roles must never be passed
 * as the principal.
 */
export function hasPermission(
  principal: PermissionPrincipal,
  permission: AdminPermission,
): boolean {
  if (
    !principal ||
    typeof permission !== "string" ||
    !knownPermissions.has(permission)
  ) {
    return false;
  }

  switch (principal.role) {
    case "SUPER_ADMIN":
      return true;
    case "USER":
    default:
      return false;
  }
}

/** Preserves checks that specifically require the existing SUPER_ADMIN role. */
export function isSuperAdmin(principal: PermissionPrincipal): boolean {
  return principal?.role === "SUPER_ADMIN";
}
