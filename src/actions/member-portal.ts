"use server";

import { db } from "@/lib/db";
import { member, household, membership, membershipYear } from "@/lib/db/schema";
import { recordAudit } from "@/lib/utils/audit";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { ActionResult } from "@/types";
import {
  memberHouseholdUpdateSchema,
  memberSelfUpdateSchema,
  memberAddDependentSchema,
  memberEditDependentSchema,
} from "@/lib/validators/member-portal";

/**
 * Get the authenticated member session and verify ACTIVE membership.
 * householdId is derived from the session — never from client input.
 */
async function getMemberSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const memberRecord = await db
    .select()
    .from(member)
    .where(eq(member.email, session.user.email))
    .limit(1);

  if (!memberRecord[0]) throw new Error("Member not found");

  // Get current membership year
  const currentYear = new Date().getFullYear();
  const yearRecord = await db
    .select()
    .from(membershipYear)
    .where(eq(membershipYear.year, currentYear))
    .limit(1);

  if (!yearRecord[0]) {
    throw new Error("Active membership required to make changes");
  }

  // Verify ACTIVE membership for current year
  const activeMembership = await db
    .select()
    .from(membership)
    .where(
      and(
        eq(membership.householdId, memberRecord[0].householdId),
        eq(membership.membershipYearId, yearRecord[0].id),
        eq(membership.status, "ACTIVE")
      )
    )
    .limit(1);

  if (!activeMembership[0]) {
    throw new Error("Active membership required to make changes");
  }

  return { session, member: memberRecord[0] };
}

/**
 * Update the authenticated member's household address and phone.
 */
export async function updateMyHousehold(
  input: unknown
): Promise<ActionResult> {
  try {
    const { member: memberRecord } = await getMemberSession();
    const data = memberHouseholdUpdateSchema.parse(input);

    await db
      .update(household)
      .set(data)
      .where(eq(household.id, memberRecord.householdId));

    await recordAudit({
      actorId: memberRecord.id,
      actorType: "MEMBER",
      action: "household.update_self",
      entityType: "household",
      entityId: memberRecord.householdId,
      metadata: { fields: Object.keys(data) },
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
 * Update the authenticated member's own profile fields.
 */
export async function updateMyProfile(
  input: unknown
): Promise<ActionResult> {
  try {
    const { member: memberRecord } = await getMemberSession();
    const data = memberSelfUpdateSchema.parse(input);

    await db
      .update(member)
      .set(data)
      .where(eq(member.id, memberRecord.id));

    await recordAudit({
      actorId: memberRecord.id,
      actorType: "MEMBER",
      action: "member.update_self",
      entityType: "member",
      entityId: memberRecord.id,
      metadata: { name: `${data.firstName} ${data.lastName}` },
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
 * Add a dependent to the authenticated member's household.
 */
export async function addMyDependent(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const { member: memberRecord } = await getMemberSession();
    const data = memberAddDependentSchema.parse(input);

    const [created] = await db
      .insert(member)
      .values({
        householdId: memberRecord.householdId,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        email: data.email,
        role: "DEPENDENT",
        isVeteranDisabled: false,
        isAdmin: false,
      })
      .returning({ id: member.id });

    await recordAudit({
      actorId: memberRecord.id,
      actorType: "MEMBER",
      action: "member.add_dependent_self",
      entityType: "member",
      entityId: created.id,
      metadata: {
        name: `${data.firstName} ${data.lastName}`,
        householdId: memberRecord.householdId,
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
 * Edit a dependent in the authenticated member's household.
 * Validates the target is a DEPENDENT in the caller's household.
 */
export async function updateMyDependent(
  dependentId: string,
  input: unknown
): Promise<ActionResult> {
  try {
    const { member: memberRecord } = await getMemberSession();
    const data = memberEditDependentSchema.parse(input);

    // Verify the dependent belongs to this household and is DEPENDENT role
    const dependent = await db
      .select()
      .from(member)
      .where(
        and(
          eq(member.id, dependentId),
          eq(member.householdId, memberRecord.householdId),
          eq(member.role, "DEPENDENT")
        )
      )
      .limit(1);

    if (!dependent[0]) {
      return { success: false, error: "Dependent not found in your household" };
    }

    await db
      .update(member)
      .set({
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        email: data.email,
      })
      .where(eq(member.id, dependentId));

    await recordAudit({
      actorId: memberRecord.id,
      actorType: "MEMBER",
      action: "member.update_dependent_self",
      entityType: "member",
      entityId: dependentId,
      metadata: {
        name: `${data.firstName} ${data.lastName}`,
        householdId: memberRecord.householdId,
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
 * Remove a dependent from the authenticated member's household.
 * Validates the target is a DEPENDENT in the caller's household.
 */
export async function removeMyDependent(
  dependentId: string
): Promise<ActionResult> {
  try {
    const { member: memberRecord } = await getMemberSession();

    // Verify the dependent belongs to this household and is DEPENDENT role
    const dependent = await db
      .select()
      .from(member)
      .where(
        and(
          eq(member.id, dependentId),
          eq(member.householdId, memberRecord.householdId),
          eq(member.role, "DEPENDENT")
        )
      )
      .limit(1);

    if (!dependent[0]) {
      return { success: false, error: "Dependent not found in your household" };
    }

    await db.delete(member).where(eq(member.id, dependentId));

    await recordAudit({
      actorId: memberRecord.id,
      actorType: "MEMBER",
      action: "member.remove_dependent_self",
      entityType: "member",
      entityId: dependentId,
      metadata: {
        name: `${dependent[0].firstName} ${dependent[0].lastName}`,
        householdId: memberRecord.householdId,
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
