"use server";

import { db } from "@/lib/db";
import {
  signupEventConfig,
  member,
  membership,
  membershipYear,
} from "@/lib/db/schema";
import { signupEventSchema } from "@/lib/validators/membership";
import { recordAudit } from "@/lib/utils/audit";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod/v4";
import type { ActionResult } from "@/types";

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
 * Create or update the sign-up event configuration for a membership year.
 * BR-7: Admin can change date/time; change logged in audit_log.
 */
export async function upsertSignupEvent(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { adminMember } = await getAdminSession();
    const data = signupEventSchema.parse(input);

    // Check if config already exists for this year
    const existing = await db
      .select()
      .from(signupEventConfig)
      .where(eq(signupEventConfig.membershipYearId, data.membershipYearId))
      .limit(1);

    if (existing[0]) {
      // Update (reschedule)
      const oldDate = existing[0].eventDate;
      const oldStartTime = existing[0].eventStartTime;

      await db
        .update(signupEventConfig)
        .set({
          eventDate: data.eventDate,
          eventStartTime: data.eventStartTime,
          eventEndTime: data.eventEndTime,
          location:
            data.location ?? "6701 Old Nest Egg Rd, Mt Sterling, KY 40353",
          notes: data.notes,
          updatedByAdminId: adminMember.id,
        })
        .where(eq(signupEventConfig.id, existing[0].id));

      await recordAudit({
        actorId: adminMember.id,
        actorType: "ADMIN",
        action: "signup_event.reschedule",
        entityType: "signup_event_config",
        entityId: existing[0].id,
        metadata: {
          oldDate,
          oldStartTime,
          newDate: data.eventDate,
          newStartTime: data.eventStartTime,
        },
      });

      return { success: true, data: { id: existing[0].id } };
    } else {
      // Create new
      const [created] = await db
        .insert(signupEventConfig)
        .values({
          membershipYearId: data.membershipYearId,
          eventDate: data.eventDate,
          eventStartTime: data.eventStartTime,
          eventEndTime: data.eventEndTime,
          location:
            data.location ?? "6701 Old Nest Egg Rd, Mt Sterling, KY 40353",
          notes: data.notes,
          updatedByAdminId: adminMember.id,
        })
        .returning({ id: signupEventConfig.id });

      await recordAudit({
        actorId: adminMember.id,
        actorType: "ADMIN",
        action: "signup_event.create",
        entityType: "signup_event_config",
        entityId: created.id,
        metadata: {
          date: data.eventDate,
          startTime: data.eventStartTime,
        },
      });

      return { success: true, data: { id: created.id } };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getSignupEvent(membershipYearId: string) {
  const result = await db
    .select()
    .from(signupEventConfig)
    .where(eq(signupEventConfig.membershipYearId, membershipYearId))
    .limit(1);
  return result[0] ?? null;
}

/**
 * Toggle the public visibility of a sign-up event.
 * When enabled, members can see the sign-up day information.
 * When disabled, the section is hidden from members.
 */
export async function toggleSignupEventVisibility(
  signupEventId: string,
): Promise<ActionResult> {
  try {
    const { adminMember } = await getAdminSession();

    const existing = await db
      .select()
      .from(signupEventConfig)
      .where(eq(signupEventConfig.id, signupEventId))
      .limit(1);

    if (!existing[0]) {
      return { success: false, error: "Sign-up event not found" };
    }

    const newValue = !existing[0].isPublic;

    await db
      .update(signupEventConfig)
      .set({
        isPublic: newValue,
        updatedByAdminId: adminMember.id,
      })
      .where(eq(signupEventConfig.id, signupEventId));

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: newValue
        ? "signup_event.make_public"
        : "signup_event.make_private",
      entityType: "signup_event_config",
      entityId: signupEventId,
      metadata: { isPublic: newValue },
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get the current public sign-up event (for member-facing pages).
 * Returns null if no event is configured or if it's not public.
 */
export async function getPublicSignupEvent() {
  const { membershipYear } = await import("@/lib/db/schema");
  const currentYear = new Date().getFullYear();

  const yearRecord = await db
    .select()
    .from(membershipYear)
    .where(eq(membershipYear.year, currentYear))
    .limit(1);

  if (!yearRecord[0]) return null;

  const result = await db
    .select()
    .from(signupEventConfig)
    .where(eq(signupEventConfig.membershipYearId, yearRecord[0].id))
    .limit(1);

  if (!result[0] || !result[0].isPublic) return null;

  return result[0];
}

const publicSignupSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.email("Valid email is required"),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  driverLicense: z.string().min(1, "Driver license number is required"),
  isVeteranDisabled: z.boolean().default(false),
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2).max(2, "State must be 2 characters"),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code"),
  phone: z.string().optional(),
});

const ALLOWED_VETERAN_DOC_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];
const MAX_VETERAN_DOC_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Public sign-up day registration.
 * Accepts FormData with text fields + optional veteran doc file.
 * Validates that sign-up day is active, checks capacity, then creates
 * household + member + NEW_PENDING membership.
 * Driver license is encrypted at rest. Veteran doc is encrypted at rest.
 */
export async function signupNewMember(
  formData: FormData,
): Promise<ActionResult<{ memberId: string; email: string }>> {
  try {
    // Extract text fields from FormData
    const rawData = {
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      email: formData.get("email") as string,
      dateOfBirth: formData.get("dateOfBirth") as string,
      driverLicense: formData.get("driverLicense") as string,
      isVeteranDisabled: formData.get("isVeteranDisabled") === "on",
      addressLine1: formData.get("addressLine1") as string,
      addressLine2: (formData.get("addressLine2") as string) || undefined,
      city: formData.get("city") as string,
      state: formData.get("state") as string,
      zip: formData.get("zip") as string,
      phone: (formData.get("phone") as string) || undefined,
    };

    const data = publicSignupSchema.parse(rawData);

    // Handle veteran doc file if present
    const veteranDocFile = formData.get("veteranDoc") as File | null;
    let veteranDocEncrypted: string | null = null;
    let veteranDocFilename: string | null = null;
    let veteranDocMimeType: string | null = null;

    if (data.isVeteranDisabled && veteranDocFile && veteranDocFile.size > 0) {
      if (!ALLOWED_VETERAN_DOC_TYPES.includes(veteranDocFile.type)) {
        return {
          success: false,
          error: "Veteran document must be PDF, JPG, or PNG.",
        };
      }
      if (veteranDocFile.size > MAX_VETERAN_DOC_SIZE) {
        return {
          success: false,
          error: "Veteran document must be under 5MB.",
        };
      }

      const { encryptBuffer } = await import("@/lib/utils/encryption");
      const fileBuffer = Buffer.from(await veteranDocFile.arrayBuffer());
      veteranDocEncrypted = encryptBuffer(fileBuffer);
      veteranDocFilename = veteranDocFile.name;
      veteranDocMimeType = veteranDocFile.type;
    }

    // Encrypt driver license
    const { encryptField } = await import("@/lib/utils/encryption");
    const driverLicenseEncrypted = encryptField(data.driverLicense);

    // Verify sign-up day is active
    const event = await getPublicSignupEvent();
    if (!event) {
      return {
        success: false,
        error: "Sign-up day is not currently open.",
      };
    }

    // Get the current membership year
    const currentYear = new Date().getFullYear();
    const yearRecord = await db
      .select()
      .from(membershipYear)
      .where(eq(membershipYear.year, currentYear))
      .limit(1);

    if (!yearRecord[0]) {
      return {
        success: false,
        error: "Membership year not configured.",
      };
    }

    // Validate event hasn't ended (M8)
    // Times are in Eastern Time (club's timezone); compare in ET
    const eventDateStr =
      typeof event.eventDate === "string"
        ? event.eventDate
        : (event.eventDate as Date).toISOString().split("T")[0];
    const endTime = event.eventEndTime.slice(0, 5); // HH:MM from HH:MM:SS
    const nowET = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    const nowInET = new Date(nowET);
    const eventEnd = new Date(`${eventDateStr}T${endTime}:00`);
    // Both are now naive dates representing ET wall-clock time
    if (nowInET > eventEnd) {
      return {
        success: false,
        error: "Sign-up day has ended.",
      };
    }

    // Check capacity (BR-1) — use non-locking read since the unique
    // constraint on (householdId, membershipYearId) prevents duplicates
    const { getCapacityDisplay } = await import("@/lib/utils/capacity");
    const capacity = await getCapacityDisplay(
      yearRecord[0].id,
      yearRecord[0].capacityCap,
    );

    if (capacity.isFull) {
      return {
        success: false,
        error: "The club is at capacity for this year. Please contact a club officer.",
      };
    }

    // Check for duplicate email
    const existingMember = await db
      .select()
      .from(member)
      .where(eq(member.email, data.email))
      .limit(1);

    if (existingMember[0]) {
      return {
        success: false,
        error: "A member with this email already exists. Please contact a club officer if you need assistance.",
      };
    }

    // Create household
    const { household } = await import("@/lib/db/schema");
    const [createdHousehold] = await db
      .insert(household)
      .values({
        name: `${data.lastName} Household`,
        email: data.email,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        state: data.state,
        zip: data.zip,
        phone: data.phone,
      })
      .returning({ id: household.id });

    // Create primary member with encrypted data included in the initial insert
    const [createdMember] = await db
      .insert(member)
      .values({
        householdId: createdHousehold.id,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        dateOfBirth: data.dateOfBirth,
        role: "PRIMARY",
        isVeteranDisabled: data.isVeteranDisabled,
        driverLicenseEncrypted,
        veteranDocEncrypted,
        veteranDocFilename,
        veteranDocMimeType,
      })
      .returning({ id: member.id });

    // Create NEW_PENDING membership with no tier assigned
    // Price is 0 until admin assigns a tier during review
    await db.insert(membership).values({
      householdId: createdHousehold.id,
      membershipYearId: yearRecord[0].id,
      status: "NEW_PENDING",
      priceCents: 0,
      discountType: "NONE",
      membershipTierId: null,
    });

    await recordAudit({
      actorId: null,
      actorType: "SYSTEM",
      action: "signup_day.new_member",
      entityType: "member",
      entityId: createdMember.id,
      metadata: {
        name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        householdId: createdHousehold.id,
        hasVeteranDoc: !!veteranDocEncrypted,
      },
    });

    // Create Better Auth user + credential account so the member can log in
    const password = formData.get("password") as string | null;
    if (password && password.length >= 8) {
      try {
        const { hashPassword } = await import("better-auth/crypto");
        const { user: userTable, account: accountTable } = await import(
          "@/lib/db/schema"
        );
        const { randomUUID } = await import("crypto");

        const hashedPassword = await hashPassword(password);
        const newUserId = randomUUID();

        await db.insert(userTable).values({
          id: newUserId,
          name: `${data.firstName} ${data.lastName}`,
          email: data.email,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.insert(accountTable).values({
          id: randomUUID(),
          accountId: newUserId,
          providerId: "credential",
          userId: newUserId,
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch {
        // Auth account creation is non-critical — signup still succeeds
        console.error("Failed to create auth account during signup");
      }
    }

    return { success: true, data: { memberId: createdMember.id, email: data.email } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
