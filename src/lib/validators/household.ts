import { z } from "zod/v4";

export const householdSchema = z.object({
  name: z.string().min(1, "Household name is required"),
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required").max(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code"),
  phone: z.string().optional(),
  email: z.email("Invalid email address"),
});

export type HouseholdInput = z.infer<typeof householdSchema>;
