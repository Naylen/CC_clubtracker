"use server";

import { db } from "@/lib/db";
import { communicationsLog, member } from "@/lib/db/schema";
import { broadcastSchema } from "@/lib/validators/broadcast";
import { recordAudit } from "@/lib/utils/audit";
import { resolveRecipients } from "@/lib/utils/resolve-recipients";
import { sendBroadcastEmail, getAvailableProviders } from "@/lib/email";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { ActionResult, RecipientFilter } from "@/types";
import type { EmailProvider } from "@/lib/email";

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
 * Send or schedule a broadcast email to filtered recipients.
 */
export async function sendBroadcast(
  input: unknown
): Promise<ActionResult<{ id: string; recipientCount: number }>> {
  try {
    const { adminMember } = await getAdminSession();
    const data = broadcastSchema.parse(input);

    const isScheduled =
      data.scheduledFor && data.scheduledFor.getTime() > Date.now();

    // For immediate sends, resolve recipients now; for scheduled, we just preview the count
    const recipients = await resolveRecipients(data.recipientFilter);
    if (recipients.length === 0) {
      return { success: false, error: "No recipients match the filter" };
    }

    const provider = data.emailProvider ?? "resend";

    if (isScheduled) {
      // Schedule for later — don't send emails yet
      const [logEntry] = await db
        .insert(communicationsLog)
        .values({
          subject: data.subject,
          body: data.body,
          recipientFilter: data.recipientFilter,
          recipientCount: recipients.length,
          sentByAdminId: adminMember.id,
          sentAt: null,
          status: "SCHEDULED",
          scheduledFor: data.scheduledFor!,
          emailProvider: provider,
        })
        .returning({ id: communicationsLog.id });

      await recordAudit({
        actorId: adminMember.id,
        actorType: "ADMIN",
        action: "broadcast.schedule",
        entityType: "communications_log",
        entityId: logEntry.id,
        metadata: {
          subject: data.subject,
          recipientCount: recipients.length,
          filter: data.recipientFilter,
          scheduledFor: data.scheduledFor!.toISOString(),
        },
      });

      return {
        success: true,
        data: { id: logEntry.id, recipientCount: recipients.length },
      };
    }

    // Immediate send
    const [logEntry] = await db
      .insert(communicationsLog)
      .values({
        subject: data.subject,
        body: data.body,
        recipientFilter: data.recipientFilter,
        recipientCount: recipients.length,
        sentByAdminId: adminMember.id,
        sentAt: new Date(),
        status: "SENT",
        emailProvider: provider,
      })
      .returning({ id: communicationsLog.id });

    // Send emails in the background (fire-and-forget)
    const logId = logEntry.id;
    void (async () => {
      try {
        const batchId = await sendBroadcastEmail({
          to: recipients,
          subject: data.subject,
          body: data.body,
          provider,
        });
        if (batchId) {
          await db
            .update(communicationsLog)
            .set({ resendBatchId: batchId })
            .where(eq(communicationsLog.id, logId));
        }
      } catch (err) {
        console.error("[broadcast] Email send failed:", err);
      }
    })();

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

/**
 * Cancel a scheduled broadcast.
 */
export async function cancelScheduledBroadcast(
  broadcastId: string
): Promise<ActionResult> {
  try {
    const { adminMember } = await getAdminSession();

    const [broadcast] = await db
      .select()
      .from(communicationsLog)
      .where(eq(communicationsLog.id, broadcastId))
      .limit(1);

    if (!broadcast) {
      return { success: false, error: "Broadcast not found" };
    }

    if (broadcast.status !== "SCHEDULED") {
      return { success: false, error: "Only scheduled broadcasts can be cancelled" };
    }

    await db
      .update(communicationsLog)
      .set({
        status: "CANCELLED",
        cancelledAt: new Date(),
      })
      .where(eq(communicationsLog.id, broadcastId));

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "broadcast.cancel",
      entityType: "communications_log",
      entityId: broadcastId,
      metadata: {
        subject: broadcast.subject,
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

export async function getBroadcasts() {
  await getAdminSession();
  return db
    .select()
    .from(communicationsLog)
    .orderBy(desc(communicationsLog.createdAt));
}

/**
 * Get the count of recipients that match a filter (for preview).
 */
export async function getRecipientCount(
  filter: RecipientFilter
): Promise<number> {
  await getAdminSession();
  const recipients = await resolveRecipients(filter);
  return recipients.length;
}

/**
 * Get the list of configured email providers for the broadcast form.
 */
export async function getEmailProviders(): Promise<
  { provider: EmailProvider; label: string }[]
> {
  return getAvailableProviders();
}
