import { z } from "zod/v4";

export const broadcastSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200),
  body: z.string().min(1, "Body is required"),
  recipientFilter: z.object({
    status: z
      .enum(["PENDING_RENEWAL", "ACTIVE", "LAPSED", "NEW_PENDING"])
      .optional(),
    year: z.number().int().optional(),
  }),
  emailProvider: z.enum(["resend", "gmail"]).default("resend"),
  scheduledFor: z.coerce.date().optional(),
  // Set by the compose form so server-side can re-link uploaded
  // attachments (broadcast_attachment.draft_id) to the broadcast row.
  draftId: z.uuid().optional(),
});

export type BroadcastInput = z.infer<typeof broadcastSchema>;
