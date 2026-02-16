import { inngest } from "../client";
import { sendBroadcastEmail } from "@/lib/email";
import { db } from "@/lib/db";
import { communicationsLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface EmailBatchEvent {
  data: {
    communicationsLogId: string;
    recipients: string[];
    subject: string;
    body: string;
  };
}

/**
 * Dispatch a broadcast email batch through Resend.
 * Triggered as an event from the broadcast server action.
 */
export const emailBatch = inngest.createFunction(
  { id: "email-batch", name: "Send Broadcast Email Batch" },
  { event: "broadcast/send" },
  async ({ event, step }) => {
    const { communicationsLogId, recipients, subject, body } =
      event.data as EmailBatchEvent["data"];

    const batchId = await step.run("send-via-resend", async () => {
      return sendBroadcastEmail({ to: recipients, subject, body });
    });

    // Update the communications log with the Resend batch ID
    if (batchId) {
      await step.run("update-comms-log", async () => {
        await db
          .update(communicationsLog)
          .set({ resendBatchId: batchId })
          .where(eq(communicationsLog.id, communicationsLogId));
      });
    }

    return { batchId, recipientCount: recipients.length };
  }
);
