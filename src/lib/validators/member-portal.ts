import { z } from "zod/v4";

/**
 * Household fields a member is allowed to update.
 * Excludes: name (auto-generated), email (used for communications).
 */
export const memberHouseholdUpdateSchema = z.object({
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required").max(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code"),
  phone: z.string().optional(),
});

export type MemberHouseholdUpdateInput = z.infer<
  typeof memberHouseholdUpdateSchema
>;

/**
 * Member fields a member is allowed to update on their own record.
 * Excludes: role, isAdmin, adminRole, membershipNumber, householdId.
 */
export const memberSelfUpdateSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.email("Invalid email").optional(),
  dateOfBirth: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Date must be YYYY-MM-DD"
  ),
  isVeteranDisabled: z.boolean().default(false),
  driverLicenseState: z
    .string()
    .length(2, "State must be 2 characters")
    .optional(),
  emergencyContactName: z
    .string()
    .min(1, "Name is required")
    .optional(),
  emergencyContactPhone: z
    .string()
    .min(1, "Phone is required")
    .optional(),
  emergencyContactRelationship: z
    .string()
    .min(1, "Relationship is required")
    .optional(),
});

export type MemberSelfUpdateInput = z.infer<typeof memberSelfUpdateSchema>;

/**
 * Adding a dependent from the member portal.
 * householdId is inferred from session. Role is always DEPENDENT.
 */
export const memberAddDependentSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Date must be YYYY-MM-DD"
  ),
  email: z.email("Invalid email").optional(),
});

export type MemberAddDependentInput = z.infer<typeof memberAddDependentSchema>;

/**
 * Editing a dependent from the member portal.
 * Same fields as add.
 */
export const memberEditDependentSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Date must be YYYY-MM-DD"
  ),
  email: z.email("Invalid email").optional(),
});

export type MemberEditDependentInput = z.infer<
  typeof memberEditDependentSchema
>;
