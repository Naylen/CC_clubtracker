import type { AdminRole } from "@/types";
import { ROLE_PERMISSIONS } from "@/types";

/**
 * Check if an admin role has a specific permission.
 */
export function hasPermission(
  adminRole: AdminRole | null | undefined,
  permission: string,
): boolean {
  if (!adminRole) return false;
  return ROLE_PERMISSIONS[adminRole]?.includes(permission) ?? false;
}

/**
 * Check if a role can manage other admins (only SUPER_ADMIN).
 */
export function canManageAdmins(adminRole: AdminRole | null | undefined): boolean {
  return hasPermission(adminRole, "admin.manage");
}

/**
 * Get the display label for an admin role.
 */
export function getAdminRoleLabel(role: AdminRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super Admin";
    case "ADMIN":
      return "Admin";
    case "OFFICER":
      return "Officer";
    default:
      return role;
  }
}

/**
 * Get the role hierarchy level (higher = more privileges).
 */
export function getRoleLevel(role: AdminRole): number {
  switch (role) {
    case "SUPER_ADMIN":
      return 3;
    case "ADMIN":
      return 2;
    case "OFFICER":
      return 1;
    default:
      return 0;
  }
}

/**
 * Check if a role can modify another role (must be strictly higher).
 */
export function canModifyRole(
  actorRole: AdminRole,
  targetRole: AdminRole | null,
): boolean {
  if (actorRole === "SUPER_ADMIN") return true;
  if (!targetRole) return getRoleLevel(actorRole) >= 2; // ADMIN+ can assign roles to non-admins
  return getRoleLevel(actorRole) > getRoleLevel(targetRole);
}
