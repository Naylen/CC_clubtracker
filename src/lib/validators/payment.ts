import { z } from "zod/v4";

export const recordPaymentSchema = z.object({
  membershipId: z.string().uuid(),
  amountCents: z.number().int().min(1),
  method: z.enum(["CASH", "CHECK"]),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
