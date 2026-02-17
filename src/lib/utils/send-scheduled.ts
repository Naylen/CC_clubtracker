import { db } from "@/lib/db";
import { communicationsLog } from "@/lib/db/schema";
import { resolveRecipients } from "@/lib/utils/resolve-recipients";
import { recordAudit } from "@/lib/utils/audit";
import { sendBroadcastEmail } from "@/lib/email";
import { eq, and, lte } from "drizzle-orm";
import type { RecipientFilter } from "@/types";
import type { EmailProvider } from "@/lib/email";

/**
 * Find and send all broadcasts whose scheduled time has arrived.
 * Called by the /api/cron/send-scheduled endpoint every 5 minutes.
 */
export async function runSendScheduled(): Promise<{
  sent: number;
  failed: number;
}> {
  const now = new Date();

  const dueBroadcasts = await db
    .select()
    .from(communicationsLog)
    .where(
      and(
        eq(communicationsLog.status, "SCHEDULED"),
        lte(communicationsLog.scheduledFor, now)
      )
    );

  let sent = 0;
  let failed = 0;

  for (const broadcast of dueBroadcasts) {
    try {
      const filter = broadcast.recipientFilter as RecipientFilter;
      const recipients = await resolveRecipients(filter);

      if (recipients.length === 0) {
        console.warn(
          `[send-scheduled] No recipients for broadcast ${broadcast.id}, skipping`
        );
        continue;
      }

      const provider = (broadcast.emailProvider ?? "resend") as EmailProvider;

      const batchId = await sendBroadcastEmail({
        to: recipients,
        subject: broadcast.subject,
        body: broadcast.body,
        provider,
      });

      await db
        .update(communicationsLog)
        .set({
          status: "SENT",
          sentAt: new Date(),
          recipientCount: recipients.length,
          resendBatchId: batchId ?? null,
        })
        .where(eq(communicationsLog.id, broadcast.id));

      await recordAudit({
        actorId: null,
        actorType: "SYSTEM",
        action: "broadcast.send_scheduled",
        entityType: "communications_log",
        entityId: broadcast.id,
        metadata: {
          subject: broadcast.subject,
          recipientCount: recipients.length,
          scheduledFor: broadcast.scheduledFor?.toISOString(),
        },
      });

      sent++;
    } catch (err) {
      console.error(
        `[send-scheduled] Failed to send broadcast ${broadcast.id}:`,
        err
      );
      failed++;
      // Leave as SCHEDULED for retry on next cron run
    }
  }

  return { sent, failed };
}
