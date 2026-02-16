import { z } from "zod/v4";

export const createMembershipYearSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  opensAt: z.string().datetime(),
  renewalDeadline: z.string().datetime(),
  capacityCap: z.number().int().min(1).max(10000).default(350),
});

export const enrollMemberSchema = z.object({
  householdId: z.string().uuid(),
  membershipYearId: z.string().uuid(),
});

export const signupEventSchema = z.object({
  membershipYearId: z.string().uuid(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  eventStartTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
  eventEndTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
  location: z.string().min(1).optional(),
  notes: z.string().optional(),
});

export const membershipTierSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  priceCents: z.number().int().min(0, "Price must be non-negative"),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export type CreateMembershipYearInput = z.infer<
  typeof createMembershipYearSchema
>;
export type EnrollMemberInput = z.infer<typeof enrollMemberSchema>;
export type SignupEventInput = z.infer<typeof signupEventSchema>;
export type MembershipTierInput = z.infer<typeof membershipTierSchema>;
