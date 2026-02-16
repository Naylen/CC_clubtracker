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
  isVeteranDisabled: z.boolean().default(false),
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2).max(2, "State must be 2 characters"),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code"),
  phone: z.string().optional(),
});

/**
 * Public sign-up day registration.
 * Validates that sign-up day is active, checks capacity, then creates
 * household + member + NEW_PENDING membership.
 */
export async function signupNewMember(
  input: unknown,
): Promise<ActionResult<{ memberId: string }>> {
  try {
    const data = publicSignupSchema.parse(input);

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

    // Check capacity
    const existingMemberships = await db
      .select()
      .from(membership)
      .where(eq(membership.membershipYearId, yearRecord[0].id));

    if (existingMemberships.length >= yearRecord[0].capacityCap) {
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

    // Create primary member
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
      })
      .returning({ id: member.id });

    // Determine price
    const basePriceCents = 20000; // $200
    const veteranDiscountCents = 10000; // $100
    const priceCents = data.isVeteranDisabled
      ? basePriceCents - veteranDiscountCents
      : basePriceCents;
    const discountType = data.isVeteranDisabled ? "VETERAN" : "NONE";

    // Create NEW_PENDING membership
    await db.insert(membership).values({
      householdId: createdHousehold.id,
      membershipYearId: yearRecord[0].id,
      status: "NEW_PENDING",
      priceCents,
      discountType,
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
      },
    });

    return { success: true, data: { memberId: createdMember.id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
