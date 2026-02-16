"use server";

import { db } from "@/lib/db";
import {
  communicationsLog,
  member,
  membership,
  household,
  membershipYear,
} from "@/lib/db/schema";
import { broadcastSchema } from "@/lib/validators/broadcast";
import { recordAudit } from "@/lib/utils/audit";
import { inngest } from "@/lib/inngest/client";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { ActionResult, RecipientFilter } from "@/types";

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
 * Resolve recipient emails based on a filter.
 */
async function resolveRecipients(
  filter: RecipientFilter
): Promise<string[]> {
  // Get the membership year if filter specifies it
  let yearId: string | undefined;
  if (filter.year) {
    const year = await db
      .select()
      .from(membershipYear)
      .where(eq(membershipYear.year, filter.year))
      .limit(1);
    yearId = year[0]?.id;
  } else {
    // Default to current year
    const currentYear = new Date().getFullYear();
    const year = await db
      .select()
      .from(membershipYear)
      .where(eq(membershipYear.year, currentYear))
      .limit(1);
    yearId = year[0]?.id;
  }

  if (!yearId) return [];

  // Build query based on status filter
  let query = db
    .select({ email: household.email })
    .from(membership)
    .innerJoin(household, eq(membership.householdId, household.id))
    .where(eq(membership.membershipYearId, yearId));

  if (filter.status) {
    query = db
      .select({ email: household.email })
      .from(membership)
      .innerJoin(household, eq(membership.householdId, household.id))
      .where(
        and(
          eq(membership.membershipYearId, yearId),
          eq(membership.status, filter.status)
        )
      );
  }

  const results = await query;
  return results.map((r) => r.email);
}

/**
 * Send a broadcast email to filtered recipients.
 */
export async function sendBroadcast(
  input: unknown
): Promise<ActionResult<{ id: string; recipientCount: number }>> {
  try {
    const { adminMember } = await getAdminSession();
    const data = broadcastSchema.parse(input);

    const recipients = await resolveRecipients(data.recipientFilter);
    if (recipients.length === 0) {
      return { success: false, error: "No recipients match the filter" };
    }

    // Create communications log entry
    const [logEntry] = await db
      .insert(communicationsLog)
      .values({
        subject: data.subject,
        body: data.body,
        recipientFilter: data.recipientFilter,
        recipientCount: recipients.length,
        sentByAdminId: adminMember.id,
        sentAt: new Date(),
      })
      .returning({ id: communicationsLog.id });

    // Dispatch via Inngest for reliable delivery
    await inngest.send({
      name: "broadcast/send",
      data: {
        communicationsLogId: logEntry.id,
        recipients,
        subject: data.subject,
        body: data.body,
      },
    });

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "broadcast.send",
      entityType: "communications_log",
      entityId: logEntry.id,
      metadata: {
        subject: data.subject,
        recipientCount: recipients.length,
        filter: data.recipientFilter,
      },
    });

    return {
      success: true,
      data: { id: logEntry.id, recipientCount: recipients.length },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getBroadcasts() {
  return db
    .select()
    .from(communicationsLog)
    .orderBy(desc(communicationsLog.sentAt));
}

/**
 * Get the count of recipients that match a filter (for preview).
 */
export async function getRecipientCount(
  filter: RecipientFilter
): Promise<number> {
  const recipients = await resolveRecipients(filter);
  return recipients.length;
}
