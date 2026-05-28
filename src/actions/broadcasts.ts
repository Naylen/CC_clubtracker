"use server";

import { db } from "@/lib/db";
import {
  broadcastAttachment,
  communicationsLog,
  member,
} from "@/lib/db/schema";
import { broadcastSchema } from "@/lib/validators/broadcast";
import sanitizeHtml from "sanitize-html";
import { recordAudit } from "@/lib/utils/audit";
import { resolveRecipients } from "@/lib/utils/resolve-recipients";
import {
  sendBroadcastEmail,
  getAvailableProviders,
  loadBroadcastAttachments,
  wrapBroadcastHtml,
} from "@/lib/email";
import { eq, desc, and, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { ActionResult, RecipientFilter } from "@/types";
import type { EmailProvider } from "@/lib/email";

/**
 * Re-link draft-stage attachments to the broadcast row they were composed
 * against. After this runs, the rows are addressable by communicationsLogId
 * and the orphan-sweep cron will leave them alone.
 *
 * No-op when no draftId is provided (older clients) or when no rows match
 * (e.g., the admin composed without attaching anything).
 */
async function linkDraftAttachments(
  draftId: string | undefined,
  communicationsLogId: string,
): Promise<void> {
  if (!draftId) return;
  await db
    .update(broadcastAttachment)
    .set({ communicationsLogId, draftId: null })
    .where(
      and(
        eq(broadcastAttachment.draftId, draftId),
        isNull(broadcastAttachment.communicationsLogId),
      ),
    );
}

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

    // Sanitize HTML body to prevent XSS in emails. data-att-id round-trips
    // so the send pipeline can map editor-inserted images to their MIME
    // parts at send time.
    const cleanBody = sanitizeHtml(data.body, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        img: ["src", "alt", "width", "height", "data-att-id"],
      },
      allowedSchemes: ["http", "https", "mailto"],
    });

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
          body: cleanBody,
          recipientFilter: data.recipientFilter,
          recipientCount: recipients.length,
          sentByAdminId: adminMember.id,
          sentAt: null,
          status: "SCHEDULED",
          scheduledFor: data.scheduledFor!,
          emailProvider: provider,
        })
        .returning({ id: communicationsLog.id });

      await linkDraftAttachments(data.draftId, logEntry.id);

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
        body: cleanBody,
        recipientFilter: data.recipientFilter,
        recipientCount: recipients.length,
        sentByAdminId: adminMember.id,
        sentAt: new Date(),
        status: "SENT",
        emailProvider: provider,
      })
      .returning({ id: communicationsLog.id });

    await linkDraftAttachments(data.draftId, logEntry.id);
    const attachments = await loadBroadcastAttachments(logEntry.id);

    // Send emails in the background (fire-and-forget)
    const logId = logEntry.id;
    void (async () => {
      try {
        const batchId = await sendBroadcastEmail({
          to: recipients,
          subject: data.subject,
          body: cleanBody,
          provider,
          attachments,
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

/**
 * Render the broadcast body the same way the send pipeline does — apply
 * the sanitizer with the same allowlist, then wrap with the standard
 * email shell. Inline image src URLs are left as in-app preview URLs so
 * the modal can render them; the cid: rewrite happens only at send time.
 */
export async function previewBroadcast(
  body: string,
): Promise<{ html: string }> {
  await getAdminSession();
  const cleanBody = sanitizeHtml(body, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "width", "height", "data-att-id"],
    },
    allowedSchemes: ["http", "https", "mailto"],
  });
  return { html: wrapBroadcastHtml(cleanBody) };
}
