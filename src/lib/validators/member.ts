import { z } from "zod/v4";

export const memberSchema = z.object({
  householdId: z.string().uuid(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.email("Invalid email").optional(),
  dateOfBirth: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Date must be YYYY-MM-DD"
  ),
  role: z.enum(["PRIMARY", "DEPENDENT"]),
  isVeteranDisabled: z.boolean().default(false),
  isAdmin: z.boolean().default(false),
  driverLicenseState: z.string().length(2, "State must be 2 characters").optional(),
  emergencyContactName: z.string().min(1, "Name is required").optional(),
  emergencyContactPhone: z.string().min(1, "Phone is required").optional(),
  emergencyContactRelationship: z.string().min(1, "Relationship is required").optional(),
});

export type MemberInput = z.infer<typeof memberSchema>;
