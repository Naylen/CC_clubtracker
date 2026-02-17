"use server";

import { db } from "@/lib/db";
import { membershipYear, member } from "@/lib/db/schema";
import { createMembershipYearSchema } from "@/lib/validators/membership";
import { recordAudit } from "@/lib/utils/audit";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { inngest } from "@/lib/inngest/client";
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

export async function createMembershipYear(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const { adminMember } = await getAdminSession();
    const data = createMembershipYearSchema.parse(input);

    const [created] = await db
      .insert(membershipYear)
      .values({
        year: data.year,
        opensAt: new Date(data.opensAt),
        renewalDeadline: new Date(data.renewalDeadline),
        capacityCap: data.capacityCap,
      })
      .returning({ id: membershipYear.id });

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "membership_year.create",
      entityType: "membership_year",
      entityId: created.id,
      metadata: { year: data.year, capacityCap: data.capacityCap },
    });

    // Find previous year to seed renewals
    const previousYear = await db
      .select()
      .from(membershipYear)
      .where(eq(membershipYear.year, data.year - 1))
      .limit(1);

    if (previousYear[0]) {
      await inngest.send({
        name: "membership-year/created",
        data: {
          membershipYearId: created.id,
          year: data.year,
          previousYearId: previousYear[0].id,
        },
      });
    }

    return { success: true, data: { id: created.id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function updateMembershipYear(
  id: string,
  input: unknown
): Promise<ActionResult> {
  try {
    const { adminMember } = await getAdminSession();
    const data = createMembershipYearSchema.parse(input);

    await db
      .update(membershipYear)
      .set({
        year: data.year,
        opensAt: new Date(data.opensAt),
        renewalDeadline: new Date(data.renewalDeadline),
        capacityCap: data.capacityCap,
      })
      .where(eq(membershipYear.id, id));

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "membership_year.update",
      entityType: "membership_year",
      entityId: id,
      metadata: { year: data.year, capacityCap: data.capacityCap },
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getMembershipYears() {
  await getAdminSession();
  return db.select().from(membershipYear).orderBy(desc(membershipYear.year));
}

export async function getMembershipYearById(id: string) {
  await getAdminSession();
  const result = await db
    .select()
    .from(membershipYear)
    .where(eq(membershipYear.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function getCurrentMembershipYear() {
  const currentYear = new Date().getFullYear();
  const result = await db
    .select()
    .from(membershipYear)
    .where(eq(membershipYear.year, currentYear))
    .limit(1);
  return result[0] ?? null;
}
