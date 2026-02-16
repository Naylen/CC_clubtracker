export type MemberRole = "PRIMARY" | "DEPENDENT";
export type MembershipStatus =
  | "PENDING_RENEWAL"
  | "ACTIVE"
  | "LAPSED"
  | "NEW_PENDING";
export type DiscountType = "NONE" | "VETERAN" | "SENIOR";
export type PaymentMethod = "STRIPE" | "CASH" | "CHECK";
export type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
export type ActorType = "ADMIN" | "SYSTEM" | "MEMBER";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface RecipientFilter {
  status?: MembershipStatus;
  year?: number;
}
