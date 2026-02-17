import { db } from "@/lib/db";
import { member, household, membership } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

// Re-export the pure formatter so existing server-side imports still work
export { formatMembershipNumber } from "./format-membership-number";

/**
 * Assign a membership number to a member if they don't already have one.
 * Uses MAX + 1 approach. Idempotent — returns existing number if already set.
 */
export async function assignMembershipNumber(
  memberId: string,
): Promise<number> {
  // Check if already assigned
  const existing = await db
    .select({ membershipNumber: member.membershipNumber })
    .from(member)
    .where(eq(member.id, memberId))
    .limit(1);

  if (existing[0]?.membershipNumber) {
    return existing[0].membershipNumber;
  }

  // Assign next number using a subquery for atomicity
  const result = await db
    .update(member)
    .set({
      membershipNumber: sql<number>`(SELECT COALESCE(MAX(${member.membershipNumber}), 0) + 1 FROM ${member})`,
    })
    .where(eq(member.id, memberId))
    .returning({ membershipNumber: member.membershipNumber });

  return result[0].membershipNumber!;
}

/**
 * Shared helper: activate a membership and assign a membership number.
 * Used by both `activateMembership()` and the Stripe webhook.
 *
 * 1. Sets membership status = ACTIVE, enrolledAt = now
 * 2. Looks up the primary member for the household
 * 3. Assigns a membership number (idempotent)
 * 4. Updates the household name to include the membership number
 */
export async function activateAndAssignNumber(
  membershipId: string,
): Promise<{ membershipNumber: number; memberName: string } | null> {
  // Activate the membership
  const [updated] = await db
    .update(membership)
    .set({
      status: "ACTIVE",
      enrolledAt: new Date(),
    })
    .where(eq(membership.id, membershipId))
    .returning({
      id: membership.id,
      householdId: membership.householdId,
    });

  if (!updated) return null;

  // Find the primary member of this household
  const primaryMember = await db
    .select({
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
    })
    .from(member)
    .where(eq(member.householdId, updated.householdId))
    .limit(1);

  // Fall back to any member if no PRIMARY found
  const target = primaryMember[0];
  if (!target) return null;

  // Assign membership number (idempotent)
  const membershipNumber = await assignMembershipNumber(target.id);
  const { formatMembershipNumber } = await import("./format-membership-number");
  const formatted = formatMembershipNumber(membershipNumber);

  // Update household name to include the membership number
  await db
    .update(household)
    .set({
      name: `${target.lastName} (${formatted}) Household`,
    })
    .where(eq(household.id, updated.householdId));

  return {
    membershipNumber,
    memberName: `${target.firstName} ${target.lastName}`,
  };
}
