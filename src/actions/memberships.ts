"use server";

import { db } from "@/lib/db";
import {
  membership,
  member,
  membershipYear,
  household,
  membershipTier,
} from "@/lib/db/schema";
import { enrollMemberSchema } from "@/lib/validators/membership";
import { recordAudit } from "@/lib/utils/audit";
import { checkCapacity } from "@/lib/utils/capacity";
import { calculatePrice, calculatePriceWithTier } from "@/lib/utils/pricing";
import { eq, and, desc, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { ActionResult } from "@/types";

async function getAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  const adminMember = await db
    .select()
    .from(member)
    .where(eq(member.email, session.user.email))
    .limit(1);
  if (!adminMember[0]?.isAdmin) throw new Error("Forbidden: Admin only");
  return { session, adminMember: adminMember[0] };
}

/**
 * Enroll a new household into a membership year.
 * BR-1: Capacity enforcement with FOR UPDATE locking.
 * BR-8: First-come/first-served (enrolledAt = NOW()).
 */
export async function enrollHousehold(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const { adminMember } = await getAdminSession();
    const data = enrollMemberSchema.parse(input);

    // Get the membership year for cap
    const year = await db
      .select()
      .from(membershipYear)
      .where(eq(membershipYear.id, data.membershipYearId))
      .limit(1);

    if (!year[0]) {
      return { success: false, error: "Membership year not found" };
    }

    // Get primary member for pricing
    const primaryMember = await db
      .select()
      .from(member)
      .where(
        and(
          eq(member.householdId, data.householdId),
          eq(member.role, "PRIMARY")
        )
      )
      .limit(1);

    if (!primaryMember[0]) {
      return { success: false, error: "No primary member found for household" };
    }

    // Calculate price (BR-4, BR-5)
    const pricing = calculatePrice({
      dateOfBirth: primaryMember[0].dateOfBirth,
      isVeteranDisabled: primaryMember[0].isVeteranDisabled,
      membershipYear: year[0].year,
    });

    // Capacity check + insert inside a transaction so the FOR UPDATE lock
    // is held until the insert completes (BR-1 race condition fix).
    const created = await db.transaction(async (tx) => {
      const capacity = await checkCapacity(
        data.membershipYearId,
        year[0].capacityCap,
        tx,
      );
      if (capacity.isFull) {
        throw new Error(
          `Membership is full (${capacity.occupied}/${capacity.cap})`,
        );
      }

      const [inserted] = await tx
        .insert(membership)
        .values({
          householdId: data.householdId,
          membershipYearId: data.membershipYearId,
          status: "NEW_PENDING",
          priceCents: pricing.priceCents,
          discountType: pricing.discountType,
        })
        .returning({ id: membership.id });

      return inserted;
    });

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "membership.enroll",
      entityType: "membership",
      entityId: created.id,
      metadata: {
        householdId: data.householdId,
        priceCents: pricing.priceCents,
        discountType: pricing.discountType,
      },
    });

    return { success: true, data: { id: created.id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Activate a membership (after payment).
 * Assigns a membership number to the primary member and updates the household name.
 */
export async function activateMembership(
  membershipId: string
): Promise<ActionResult> {
  try {
    const { activateAndAssignNumber } = await import(
      "@/lib/utils/membership-number"
    );

    const result = await activateAndAssignNumber(membershipId);

    if (result) {
      await recordAudit({
        actorId: null,
        actorType: "SYSTEM",
        action: "membership.activate",
        entityType: "membership",
        entityId: membershipId,
        metadata: {
          membershipNumber: result.membershipNumber,
          memberName: result.memberName,
        },
      });
    }

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getMembershipsByYear(membershipYearId: string) {
  await getAdminSession();
  return db
    .select()
    .from(membership)
    .where(eq(membership.membershipYearId, membershipYearId))
    .orderBy(membership.status);
}

export async function getMembershipsByHousehold(householdId: string) {
  await getAdminSession();
  return db
    .select()
    .from(membership)
    .where(eq(membership.householdId, householdId))
    .orderBy(desc(membership.createdAt));
}

export async function getMembershipForMember(
  householdId: string,
  membershipYearId: string
) {
  const result = await db
    .select()
    .from(membership)
    .where(
      and(
        eq(membership.householdId, householdId),
        eq(membership.membershipYearId, membershipYearId)
      )
    )
    .limit(1);
  return result[0] ?? null;
}

/**
 * Get pending applications — NEW_PENDING with no tier assigned.
 */
export async function getPendingApplications() {
  await getAdminSession();
  const rows = await db
    .select({
      membershipId: membership.id,
      householdId: membership.householdId,
      householdName: household.name,
      householdEmail: household.email,
      memberId: member.id,
      memberFirstName: member.firstName,
      memberLastName: member.lastName,
      memberEmail: member.email,
      dateOfBirth: member.dateOfBirth,
      isVeteranDisabled: member.isVeteranDisabled,
      veteranDocFilename: member.veteranDocFilename,
      createdAt: membership.createdAt,
      membershipYearId: membership.membershipYearId,
    })
    .from(membership)
    .innerJoin(household, eq(membership.householdId, household.id))
    .innerJoin(
      member,
      and(
        eq(member.householdId, household.id),
        eq(member.role, "PRIMARY")
      )
    )
    .where(
      and(
        eq(membership.status, "NEW_PENDING"),
        isNull(membership.membershipTierId)
      )
    )
    .orderBy(membership.createdAt);

  return rows;
}

/**
 * Get approved applications — NEW_PENDING with tier assigned, awaiting payment.
 */
export async function getApprovedAwaitingPayment() {
  await getAdminSession();
  const rows = await db
    .select({
      membershipId: membership.id,
      householdId: membership.householdId,
      householdName: household.name,
      householdEmail: household.email,
      memberFirstName: member.firstName,
      memberLastName: member.lastName,
      priceCents: membership.priceCents,
      discountType: membership.discountType,
      tierName: membershipTier.name,
      membershipTierId: membership.membershipTierId,
      createdAt: membership.createdAt,
    })
    .from(membership)
    .innerJoin(household, eq(membership.householdId, household.id))
    .innerJoin(
      member,
      and(
        eq(member.householdId, household.id),
        eq(member.role, "PRIMARY")
      )
    )
    .leftJoin(
      membershipTier,
      eq(membership.membershipTierId, membershipTier.id)
    )
    .where(
      and(
        eq(membership.status, "NEW_PENDING"),
        membership.membershipTierId !== null
          ? eq(membership.membershipTierId, membership.membershipTierId)
          : undefined
      )
    )
    .orderBy(membership.createdAt);

  // Filter to only those with a tier assigned (non-null membershipTierId)
  return rows.filter((r) => r.membershipTierId !== null);
}

/**
 * Approve an application by assigning a membership tier.
 * Calculates price based on the tier + veteran/senior discounts.
 */
export async function approveApplication(
  membershipId: string,
  membershipTierId: string
): Promise<ActionResult> {
  try {
    const { adminMember } = await getAdminSession();

    // Get the membership
    const membershipRecord = await db
      .select()
      .from(membership)
      .where(eq(membership.id, membershipId))
      .limit(1);

    if (!membershipRecord[0]) {
      return { success: false, error: "Membership not found" };
    }

    // Get the tier
    const tier = await db
      .select()
      .from(membershipTier)
      .where(eq(membershipTier.id, membershipTierId))
      .limit(1);

    if (!tier[0]) {
      return { success: false, error: "Membership tier not found" };
    }

    // Get the primary member for pricing discounts
    const primaryMember = await db
      .select()
      .from(member)
      .where(
        and(
          eq(member.householdId, membershipRecord[0].householdId),
          eq(member.role, "PRIMARY")
        )
      )
      .limit(1);

    if (!primaryMember[0]) {
      return { success: false, error: "Primary member not found" };
    }

    // Get the membership year
    const year = await db
      .select()
      .from(membershipYear)
      .where(eq(membershipYear.id, membershipRecord[0].membershipYearId))
      .limit(1);

    // Calculate price with tier + discounts
    const pricing = calculatePriceWithTier({
      tierPriceCents: tier[0].priceCents,
      dateOfBirth: primaryMember[0].dateOfBirth,
      isVeteranDisabled: primaryMember[0].isVeteranDisabled,
      membershipYear: year[0]?.year ?? new Date().getFullYear(),
    });

    // Update the membership with tier assignment and calculated price
    await db
      .update(membership)
      .set({
        membershipTierId,
        priceCents: pricing.priceCents,
        discountType: pricing.discountType,
      })
      .where(eq(membership.id, membershipId));

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "application.approve",
      entityType: "membership",
      entityId: membershipId,
      metadata: {
        tierName: tier[0].name,
        priceCents: pricing.priceCents,
        discountType: pricing.discountType,
      },
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Reject an application — deletes the membership, household, and member records.
 */
export async function rejectApplication(
  membershipId: string
): Promise<ActionResult> {
  try {
    const { adminMember } = await getAdminSession();

    // Get the membership to find the household
    const membershipRecord = await db
      .select()
      .from(membership)
      .where(eq(membership.id, membershipId))
      .limit(1);

    if (!membershipRecord[0]) {
      return { success: false, error: "Membership not found" };
    }

    const householdId = membershipRecord[0].householdId;

    // Get household name for audit
    const householdRecord = await db
      .select()
      .from(household)
      .where(eq(household.id, householdId))
      .limit(1);

    // Delete the membership first (FK constraint)
    await db.delete(membership).where(eq(membership.id, membershipId));

    // Delete members in the household
    await db.delete(member).where(eq(member.householdId, householdId));

    // Delete the household
    await db.delete(household).where(eq(household.id, householdId));

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "application.reject",
      entityType: "membership",
      entityId: membershipId,
      metadata: {
        householdName: householdRecord[0]?.name ?? "Unknown",
        householdId,
      },
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get the current membership for the member portal.
 * Finds the membership for the current year and returns status/pricing info.
 */
export async function getCurrentMembershipForPortal(householdId: string) {
  const currentYear = new Date().getFullYear();

  // Get the current membership year
  const yearRecord = await db
    .select()
    .from(membershipYear)
    .where(eq(membershipYear.year, currentYear))
    .limit(1);

  if (!yearRecord[0]) return null;

  const result = await db
    .select({
      id: membership.id,
      status: membership.status,
      priceCents: membership.priceCents,
      discountType: membership.discountType,
      membershipTierId: membership.membershipTierId,
      enrolledAt: membership.enrolledAt,
      tierName: membershipTier.name,
    })
    .from(membership)
    .leftJoin(
      membershipTier,
      eq(membership.membershipTierId, membershipTier.id)
    )
    .where(
      and(
        eq(membership.householdId, householdId),
        eq(membership.membershipYearId, yearRecord[0].id)
      )
    )
    .limit(1);

  return result[0] ?? null;
}
