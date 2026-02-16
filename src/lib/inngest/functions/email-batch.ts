import { inngest } from "../client";
import { sendBroadcastEmail } from "@/lib/email";
import { db } from "@/lib/db";
import { communicationsLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { EmailProvider } from "@/lib/email";

interface EmailBatchEvent {
  data: {
    communicationsLogId: string;
    recipients: string[];
    subject: string;
    body: string;
    emailProvider?: EmailProvider;
  };
}

/**
 * Dispatch a broadcast email batch through the selected provider.
 * Triggered as an event from the broadcast server action.
 */
export const emailBatch = inngest.createFunction(
  { id: "email-batch", name: "Send Broadcast Email Batch" },
  { event: "broadcast/send" },
  async ({ event, step }) => {
    const {
      communicationsLogId,
      recipients,
      subject,
      body,
      emailProvider = "resend",
    } = event.data as EmailBatchEvent["data"];

    const batchId = await step.run(
      `send-via-${emailProvider}`,
      async () => {
        return sendBroadcastEmail({
          to: recipients,
          subject,
          body,
          provider: emailProvider,
        });
      }
    );

    // Update the communications log with the batch/tracking ID
    if (batchId) {
      await step.run("update-comms-log", async () => {
        await db
          .update(communicationsLog)
          .set({ resendBatchId: batchId })
          .where(eq(communicationsLog.id, communicationsLogId));
      });
    }

    return { batchId, recipientCount: recipients.length, provider: emailProvider };
  }
);
