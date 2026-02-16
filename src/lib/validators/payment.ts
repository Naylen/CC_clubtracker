import { z } from "zod/v4";

export const recordPaymentSchema = z
  .object({
    membershipId: z.string().uuid(),
    amountCents: z.number().int().min(1),
    method: z.enum(["CASH", "CHECK"]),
    checkNumber: z.string().max(50).optional(),
  })
  .refine(
    (data) => {
      if (data.method === "CHECK") {
        return !!data.checkNumber && data.checkNumber.trim().length > 0;
      }
      return true;
    },
    {
      message: "Check number is required for check payments",
      path: ["checkNumber"],
    }
  );

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
