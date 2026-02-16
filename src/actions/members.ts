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
  input: unknown
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
  input: unknown
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
    .where(
      and(eq(member.householdId, householdId), eq(member.role, "PRIMARY"))
    )
    .limit(1);
  return result[0] ?? null;
}
