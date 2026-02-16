"use server";

import { db } from "@/lib/db";
import { signupEventConfig, member } from "@/lib/db/schema";
import { signupEventSchema } from "@/lib/validators/membership";
import { recordAudit } from "@/lib/utils/audit";
import { eq } from "drizzle-orm";
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
 * Create or update the sign-up event configuration for a membership year.
 * BR-7: Admin can change date/time; change logged in audit_log.
 */
export async function upsertSignupEvent(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const { adminMember } = await getAdminSession();
    const data = signupEventSchema.parse(input);

    // Check if config already exists for this year
    const existing = await db
      .select()
      .from(signupEventConfig)
      .where(eq(signupEventConfig.membershipYearId, data.membershipYearId))
      .limit(1);

    if (existing[0]) {
      // Update (reschedule)
      const oldDate = existing[0].eventDate;
      const oldStartTime = existing[0].eventStartTime;

      await db
        .update(signupEventConfig)
        .set({
          eventDate: data.eventDate,
          eventStartTime: data.eventStartTime,
          eventEndTime: data.eventEndTime,
          location:
            data.location ?? "6701 Old Nest Egg Rd, Mt Sterling, KY 40353",
          notes: data.notes,
          updatedByAdminId: adminMember.id,
        })
        .where(eq(signupEventConfig.id, existing[0].id));

      await recordAudit({
        actorId: adminMember.id,
        actorType: "ADMIN",
        action: "signup_event.reschedule",
        entityType: "signup_event_config",
        entityId: existing[0].id,
        metadata: {
          oldDate,
          oldStartTime,
          newDate: data.eventDate,
          newStartTime: data.eventStartTime,
        },
      });

      return { success: true, data: { id: existing[0].id } };
    } else {
      // Create new
      const [created] = await db
        .insert(signupEventConfig)
        .values({
          membershipYearId: data.membershipYearId,
          eventDate: data.eventDate,
          eventStartTime: data.eventStartTime,
          eventEndTime: data.eventEndTime,
          location:
            data.location ?? "6701 Old Nest Egg Rd, Mt Sterling, KY 40353",
          notes: data.notes,
          updatedByAdminId: adminMember.id,
        })
        .returning({ id: signupEventConfig.id });

      await recordAudit({
        actorId: adminMember.id,
        actorType: "ADMIN",
        action: "signup_event.create",
        entityType: "signup_event_config",
        entityId: created.id,
        metadata: {
          date: data.eventDate,
          startTime: data.eventStartTime,
        },
      });

      return { success: true, data: { id: created.id } };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getSignupEvent(membershipYearId: string) {
  const result = await db
    .select()
    .from(signupEventConfig)
    .where(eq(signupEventConfig.membershipYearId, membershipYearId))
    .limit(1);
  return result[0] ?? null;
}
