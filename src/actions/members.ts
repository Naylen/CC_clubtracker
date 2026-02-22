"use server";

import { db } from "@/lib/db";
import { member } from "@/lib/db/schema";
import { memberSchema } from "@/lib/validators/member";
import { recordAudit } from "@/lib/utils/audit";
import { eq, and, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { ActionResult, AdminRole } from "@/types";
import { canManageAdmins } from "@/lib/utils/rbac";

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

async function getSuperAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  const adminMember = await db
    .select()
    .from(member)
    .where(eq(member.email, session.user.email))
    .limit(1);
  if (!adminMember[0]?.isAdmin) throw new Error("Forbidden: Admin only");
  if (!canManageAdmins(adminMember[0].adminRole as AdminRole | null)) {
    throw new Error("Forbidden: Only Super Admins can perform this action");
  }
  return { session, adminMember: adminMember[0] };
}

export async function createMember(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { adminMember } = await getAdminSession();
    const data = memberSchema.parse(input);

    const [created] = await db
      .insert(member)
      .values(data)
      .returning({ id: member.id });

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "member.create",
      entityType: "member",
      entityId: created.id,
      metadata: { name: `${data.firstName} ${data.lastName}`, role: data.role },
    });

    return { success: true, data: { id: created.id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function updateMember(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const { adminMember } = await getAdminSession();
    const data = memberSchema.parse(input);

    await db.update(member).set(data).where(eq(member.id, id));

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "member.update",
      entityType: "member",
      entityId: id,
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

export async function deleteMember(id: string): Promise<ActionResult> {
  try {
    const { adminMember } = await getAdminSession();

    await db.delete(member).where(eq(member.id, id));

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "member.delete",
      entityType: "member",
      entityId: id,
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getMembersByHousehold(householdId: string) {
  await getAdminSession();
  return db
    .select()
    .from(member)
    .where(eq(member.householdId, householdId))
    .orderBy(member.role, member.lastName);
}

export async function getPrimaryMember(householdId: string) {
  await getAdminSession();
  const result = await db
    .select()
    .from(member)
    .where(and(eq(member.householdId, householdId), eq(member.role, "PRIMARY")))
    .limit(1);
  return result[0] ?? null;
}

export async function getMembersWithHousehold() {
  await getAdminSession();
  const { household } = await import("@/lib/db/schema");
  return db
    .select({
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      role: member.role,
      dateOfBirth: member.dateOfBirth,
      isVeteranDisabled: member.isVeteranDisabled,
      isAdmin: member.isAdmin,
      membershipNumber: member.membershipNumber,
      householdId: member.householdId,
      householdName: household.name,
      householdEmail: household.email,
      city: household.city,
      state: household.state,
    })
    .from(member)
    .innerJoin(household, eq(member.householdId, household.id))
    .orderBy(member.lastName, member.firstName);
}

export async function getMemberById(id: string) {
  await getAdminSession();
  const result = await db
    .select()
    .from(member)
    .where(eq(member.id, id))
    .limit(1);
  return result[0] ?? null;
}

/**
 * Create a new primary member along with their household in one step.
 * The member joins the club, then their household is created automatically.
 */
export async function createMemberWithHousehold(
  input: unknown,
): Promise<ActionResult<{ memberId: string; householdId: string }>> {
  try {
    const { adminMember } = await getAdminSession();
    const { household } = await import("@/lib/db/schema");
    const { z } = await import("zod/v4");

    const schema = z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.email(),
      dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      isVeteranDisabled: z.boolean().default(false),
      addressLine1: z.string().min(1),
      addressLine2: z.string().optional(),
      city: z.string().min(1),
      state: z.string().min(2).max(2),
      zip: z.string().regex(/^\d{5}(-\d{4})?$/),
      phone: z.string().optional(),
    });

    const data = schema.parse(input);

    // Create household first (named after the member)
    const [createdHousehold] = await db
      .insert(household)
      .values({
        name: `${data.lastName} Household`,
        email: data.email,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        state: data.state,
        zip: data.zip,
        phone: data.phone,
      })
      .returning({ id: household.id });

    // Create the primary member
    const [createdMember] = await db
      .insert(member)
      .values({
        householdId: createdHousehold.id,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        dateOfBirth: data.dateOfBirth,
        role: "PRIMARY",
        isVeteranDisabled: data.isVeteranDisabled,
      })
      .returning({ id: member.id });

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "member.create_with_household",
      entityType: "member",
      entityId: createdMember.id,
      metadata: {
        name: `${data.firstName} ${data.lastName}`,
        householdId: createdHousehold.id,
      },
    });

    return {
      success: true,
      data: { memberId: createdMember.id, householdId: createdHousehold.id },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Add a household member (dependent) to an existing member's household.
 */
export async function addHouseholdMember(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { adminMember } = await getAdminSession();
    const data = memberSchema.parse(input);

    // Ensure role is DEPENDENT for household additions
    const [created] = await db
      .insert(member)
      .values({
        ...data,
        role: "DEPENDENT",
      })
      .returning({ id: member.id });

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "member.add_household_member",
      entityType: "member",
      entityId: created.id,
      metadata: {
        name: `${data.firstName} ${data.lastName}`,
        householdId: data.householdId,
        role: "DEPENDENT",
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
 * Soft-remove a household's current-year membership.
 * Sets status to REMOVED with a reason. Records stay for posterity.
 */
export async function removeMember(
  input: unknown,
): Promise<ActionResult> {
  try {
    const { adminMember } = await getAdminSession();
    const { removeMemberSchema } = await import(
      "@/lib/validators/membership"
    );
    const data = removeMemberSchema.parse(input);

    const { membership, membershipYear } = await import("@/lib/db/schema");
    const { household } = await import("@/lib/db/schema");

    // Find current-year membership
    const currentYear = new Date().getFullYear();
    const yearRecord = await db
      .select()
      .from(membershipYear)
      .where(eq(membershipYear.year, currentYear))
      .limit(1);

    if (!yearRecord[0]) {
      return { success: false, error: "No membership year found for current year" };
    }

    const existing = await db
      .select()
      .from(membership)
      .where(
        and(
          eq(membership.householdId, data.householdId),
          eq(membership.membershipYearId, yearRecord[0].id),
        ),
      )
      .limit(1);

    if (!existing[0]) {
      return { success: false, error: "No current-year membership found for this household" };
    }

    if (existing[0].status === "REMOVED") {
      return { success: false, error: "Membership is already removed" };
    }

    const previousStatus = existing[0].status;

    // Update to REMOVED
    await db
      .update(membership)
      .set({
        status: "REMOVED",
        removalReason: data.reason,
        removalNotes: data.notes ?? null,
        removedAt: new Date(),
      })
      .where(eq(membership.id, existing[0].id));

    // Get household name for audit
    const householdRecord = await db
      .select({ name: household.name })
      .from(household)
      .where(eq(household.id, data.householdId))
      .limit(1);

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "membership.remove",
      entityType: "membership",
      entityId: existing[0].id,
      metadata: {
        reason: data.reason,
        notes: data.notes,
        previousStatus,
        householdName: householdRecord[0]?.name,
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
 * Permanently delete all records for a household (hard purge).
 * Super Admin only. For test data cleanup.
 */
export async function purgeHousehold(
  input: unknown,
): Promise<ActionResult> {
  try {
    const { adminMember } = await getSuperAdminSession();
    const { purgeMemberSchema } = await import(
      "@/lib/validators/membership"
    );
    const data = purgeMemberSchema.parse(input);

    const {
      household,
      membership,
      payment,
      auditLog,
      communicationsLog,
      signupEventConfig,
      user,
    } = await import("@/lib/db/schema");

    // Verify household exists and name matches
    const householdRecord = await db
      .select()
      .from(household)
      .where(eq(household.id, data.householdId))
      .limit(1);

    if (!householdRecord[0]) {
      return { success: false, error: "Household not found" };
    }

    if (householdRecord[0].name !== data.confirmName) {
      return { success: false, error: "Household name does not match" };
    }

    // Get all member IDs for this household
    const householdMembers = await db
      .select({ id: member.id, email: member.email })
      .from(member)
      .where(eq(member.householdId, data.householdId));

    const memberIds = householdMembers.map((m) => m.id);
    const memberEmails = householdMembers
      .map((m) => m.email)
      .filter((e): e is string => e !== null);

    // Check for NOT NULL FK refs that would block deletion
    for (const memberId of memberIds) {
      const commsRef = await db
        .select({ id: communicationsLog.id })
        .from(communicationsLog)
        .where(eq(communicationsLog.sentByAdminId, memberId))
        .limit(1);

      if (commsRef[0]) {
        return {
          success: false,
          error:
            "Cannot purge: a member in this household has sent broadcasts. Remove their admin role and reassign broadcasts first.",
        };
      }

      const signupRef = await db
        .select({ id: signupEventConfig.id })
        .from(signupEventConfig)
        .where(eq(signupEventConfig.updatedByAdminId, memberId))
        .limit(1);

      if (signupRef[0]) {
        return {
          success: false,
          error:
            "Cannot purge: a member in this household has updated signup events. Reassign those records first.",
        };
      }
    }

    // Null out nullable FK refs
    for (const memberId of memberIds) {
      await db
        .update(payment)
        .set({ recordedByAdminId: null })
        .where(eq(payment.recordedByAdminId, memberId));

      await db
        .update(auditLog)
        .set({ actorId: null })
        .where(eq(auditLog.actorId, memberId));
    }

    // Delete auth user records by member emails (cascades to session + account)
    for (const email of memberEmails) {
      await db.delete(user).where(eq(user.email, email));
    }

    // Delete household (cascades to member, membership, payment via membership)
    await db.delete(household).where(eq(household.id, data.householdId));

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "household.purge",
      entityType: "household",
      entityId: data.householdId,
      metadata: {
        householdName: householdRecord[0].name,
        memberEmails,
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
