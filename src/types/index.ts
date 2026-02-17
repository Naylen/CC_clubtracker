export type MemberRole = "PRIMARY" | "DEPENDENT";
export type AdminRole = "SUPER_ADMIN" | "ADMIN" | "OFFICER";
export type MembershipStatus =
  | "PENDING_RENEWAL"
  | "ACTIVE"
  | "LAPSED"
  | "NEW_PENDING";
export type DiscountType = "NONE" | "VETERAN" | "SENIOR";
export type PaymentMethod = "STRIPE" | "CASH" | "CHECK";
export type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
export type ActorType = "ADMIN" | "SYSTEM" | "MEMBER";
export type BroadcastStatus = "SENT" | "SCHEDULED" | "CANCELLED";

/**
 * RBAC Permission Map:
 * SUPER_ADMIN: All permissions + manage admins
 * ADMIN: All operational permissions (members, years, payments, broadcasts, audit)
 * OFFICER: View members, manage sign-up day, view payments
 */
export const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  SUPER_ADMIN: [
    "admin.manage",
    "members.create",
    "members.read",
    "members.update",
    "members.delete",
    "households.create",
    "households.read",
    "households.update",
    "years.create",
    "years.read",
    "years.update",
    "payments.read",
    "payments.create",
    "broadcasts.create",
    "broadcasts.read",
    "signup_event.manage",
    "audit.read",
  ],
  ADMIN: [
    "members.create",
    "members.read",
    "members.update",
    "members.delete",
    "households.create",
    "households.read",
    "households.update",
    "years.create",
    "years.read",
    "years.update",
    "payments.read",
    "payments.create",
    "broadcasts.create",
    "broadcasts.read",
    "signup_event.manage",
    "audit.read",
  ],
  OFFICER: [
    "members.read",
    "households.read",
    "years.read",
    "payments.read",
    "signup_event.manage",
  ],
};

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface RecipientFilter {
  status?: MembershipStatus;
  year?: number;
}
