"use server";

import { db } from "@/lib/db";
import { household, member } from "@/lib/db/schema";
import { householdSchema } from "@/lib/validators/household";
import { recordAudit } from "@/lib/utils/audit";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { ActionResult } from "@/types";

async function getAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  // Verify admin status via member table
  const adminMember = await db
    .select()
    .from(member)
    .where(eq(member.email, session.user.email))
    .limit(1);
  if (!adminMember[0]?.isAdmin) throw new Error("Forbidden: Admin only");
  return { session, adminMember: adminMember[0] };
}

export async function createHousehold(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const { adminMember } = await getAdminSession();
    const data = householdSchema.parse(input);

    const [created] = await db
      .insert(household)
      .values(data)
      .returning({ id: household.id });

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "household.create",
      entityType: "household",
      entityId: created.id,
      metadata: { name: data.name },
    });

    return { success: true, data: { id: created.id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function updateHousehold(
  id: string,
  input: unknown
): Promise<ActionResult> {
  try {
    const { adminMember } = await getAdminSession();
    const data = householdSchema.parse(input);

    await db.update(household).set(data).where(eq(household.id, id));

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "household.update",
      entityType: "household",
      entityId: id,
      metadata: { name: data.name },
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function deleteHousehold(id: string): Promise<ActionResult> {
  try {
    const { adminMember } = await getAdminSession();

    await db.delete(household).where(eq(household.id, id));

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "household.delete",
      entityType: "household",
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

export async function getHouseholds() {
  return db.select().from(household).orderBy(household.name);
}

export async function getHouseholdById(id: string) {
  const result = await db
    .select()
    .from(household)
    .where(eq(household.id, id))
    .limit(1);
  return result[0] ?? null;
}
