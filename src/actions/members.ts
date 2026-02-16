"use server";

import { db } from "@/lib/db";
import { member } from "@/lib/db/schema";
import { memberSchema } from "@/lib/validators/member";
import { recordAudit } from "@/lib/utils/audit";
import { eq, and } from "drizzle-orm";
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
  return db
    .select()
    .from(member)
    .where(eq(member.householdId, householdId))
    .orderBy(member.role, member.lastName);
}

export async function getPrimaryMember(householdId: string) {
  const result = await db
    .select()
    .from(member)
    .where(and(eq(member.householdId, householdId), eq(member.role, "PRIMARY")))
    .limit(1);
  return result[0] ?? null;
}

export async function getMembersWithHousehold() {
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
