"use server";

import { db } from "@/lib/db";
import { membership, member, membershipYear } from "@/lib/db/schema";
import { enrollMemberSchema } from "@/lib/validators/membership";
import { recordAudit } from "@/lib/utils/audit";
import { checkCapacity } from "@/lib/utils/capacity";
import { calculatePrice } from "@/lib/utils/pricing";
import { eq, and, desc } from "drizzle-orm";
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

    // Check capacity (BR-1)
    const capacity = await checkCapacity(
      data.membershipYearId,
      year[0].capacityCap
    );
    if (capacity.isFull) {
      return {
        success: false,
        error: `Membership is full (${capacity.occupied}/${capacity.cap})`,
      };
    }

    // Calculate price (BR-4, BR-5)
    const pricing = calculatePrice({
      dateOfBirth: primaryMember[0].dateOfBirth,
      isVeteranDisabled: primaryMember[0].isVeteranDisabled,
      membershipYear: year[0].year,
    });

    const [created] = await db
      .insert(membership)
      .values({
        householdId: data.householdId,
        membershipYearId: data.membershipYearId,
        status: "NEW_PENDING",
        priceCents: pricing.priceCents,
        discountType: pricing.discountType,
      })
      .returning({ id: membership.id });

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
 */
export async function activateMembership(
  membershipId: string
): Promise<ActionResult> {
  try {
    await db
      .update(membership)
      .set({
        status: "ACTIVE",
        enrolledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(membership.id, membershipId));

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getMembershipsByYear(membershipYearId: string) {
  return db
    .select()
    .from(membership)
    .where(eq(membership.membershipYearId, membershipYearId))
    .orderBy(membership.status);
}

export async function getMembershipsByHousehold(householdId: string) {
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
