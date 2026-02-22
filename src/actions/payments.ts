"use server";

import { db } from "@/lib/db";
import { payment, membership, member, household } from "@/lib/db/schema";
import { recordPaymentSchema } from "@/lib/validators/payment";
import { recordAudit } from "@/lib/utils/audit";
import { activateAndAssignNumber } from "@/lib/utils/membership-number";
import { createCheckoutSession, retrieveCheckoutSession } from "@/lib/stripe";
import { eq, desc, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
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
 * Record an in-person payment (cash/check) by an admin.
 */
export async function recordPayment(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const { adminMember } = await getAdminSession();
    const data = recordPaymentSchema.parse(input);

    // Verify membership exists and is in a payable state (M7)
    const membershipRecord = await db
      .select()
      .from(membership)
      .where(eq(membership.id, data.membershipId))
      .limit(1);

    if (!membershipRecord[0]) {
      return { success: false, error: "Membership not found" };
    }

    const payableStatuses = ["NEW_PENDING", "PENDING_RENEWAL"];
    if (!payableStatuses.includes(membershipRecord[0].status)) {
      return {
        success: false,
        error: `Cannot record payment: membership is ${membershipRecord[0].status}`,
      };
    }

    // Verify amount matches membership price (M4)
    if (data.amountCents !== membershipRecord[0].priceCents) {
      return {
        success: false,
        error: `Amount mismatch: expected ${membershipRecord[0].priceCents} cents, got ${data.amountCents}`,
      };
    }

    const [created] = await db
      .insert(payment)
      .values({
        membershipId: data.membershipId,
        amountCents: data.amountCents,
        method: data.method,
        checkNumber: data.method === "CHECK" ? data.checkNumber ?? null : null,
        recordedByAdminId: adminMember.id,
        status: "SUCCEEDED",
        paidAt: new Date(),
      })
      .returning({ id: payment.id });

    // Activate the membership and assign membership number
    await activateAndAssignNumber(data.membershipId);

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "payment.record",
      entityType: "payment",
      entityId: created.id,
      metadata: {
        membershipId: data.membershipId,
        amountCents: data.amountCents,
        method: data.method,
        ...(data.checkNumber ? { checkNumber: data.checkNumber } : {}),
      },
    });

    return { success: true, data: { id: created.id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create a Stripe Checkout session for a membership renewal.
 */
export async function createStripeCheckout(
  membershipId: string
): Promise<ActionResult<{ url: string }>> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Unauthorized" };

    // Verify caller owns this membership (C2: IDOR protection)
    const callerMember = await db
      .select()
      .from(member)
      .where(eq(member.email, session.user.email))
      .limit(1);

    if (!callerMember[0]) {
      return { success: false, error: "Member not found" };
    }

    // Get the membership with related data
    const membershipRecord = await db
      .select()
      .from(membership)
      .where(eq(membership.id, membershipId))
      .limit(1);

    if (!membershipRecord[0]) {
      return { success: false, error: "Membership not found" };
    }

    // Verify membership is in a payable state
    const payableStatuses = ["NEW_PENDING", "PENDING_RENEWAL"];
    if (!payableStatuses.includes(membershipRecord[0].status)) {
      return {
        success: false,
        error: `Cannot pay: membership status is ${membershipRecord[0].status}`,
      };
    }

    // Verify membership belongs to caller's household
    if (membershipRecord[0].householdId !== callerMember[0].householdId) {
      return { success: false, error: "Forbidden" };
    }

    const householdRecord = await db
      .select()
      .from(household)
      .where(eq(household.id, membershipRecord[0].householdId))
      .limit(1);

    if (!householdRecord[0]) {
      return { success: false, error: "Household not found" };
    }

    // Get the year number
    const { membershipYear } = await import("@/lib/db/schema");
    const yearRecord = await db
      .select()
      .from(membershipYear)
      .where(eq(membershipYear.id, membershipRecord[0].membershipYearId))
      .limit(1);

    const { url, sessionId } = await createCheckoutSession({
      membershipId,
      householdName: householdRecord[0].name,
      amountCents: membershipRecord[0].priceCents,
      membershipYear: yearRecord[0]?.year ?? new Date().getFullYear(),
      customerEmail: householdRecord[0].email,
    });

    // Create pending payment with Stripe session ID for webhook/verification matching
    await db.insert(payment).values({
      membershipId,
      amountCents: membershipRecord[0].priceCents,
      method: "STRIPE",
      status: "PENDING",
      stripeSessionId: sessionId,
    });

    return { success: true, data: { url } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getPayments() {
  await getAdminSession();
  const { membershipYear } = await import("@/lib/db/schema");
  const { sql } = await import("drizzle-orm");

  // Join payment → membership → household for household name
  // Also join member for recorded-by admin name
  const rows = await db
    .select({
      id: payment.id,
      membershipId: payment.membershipId,
      amountCents: payment.amountCents,
      method: payment.method,
      checkNumber: payment.checkNumber,
      stripeSessionId: payment.stripeSessionId,
      status: payment.status,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      householdName: household.name,
      recordedByName: sql<string | null>`
        CASE WHEN ${member.id} IS NOT NULL
          THEN ${member.firstName} || ' ' || ${member.lastName}
          ELSE NULL
        END
      `,
    })
    .from(payment)
    .leftJoin(membership, eq(payment.membershipId, membership.id))
    .leftJoin(household, eq(membership.householdId, household.id))
    .leftJoin(member, eq(payment.recordedByAdminId, member.id))
    .orderBy(desc(payment.createdAt));

  return rows;
}

export async function getPaymentsByMembership(membershipId: string) {
  await getAdminSession();
  return db
    .select()
    .from(payment)
    .where(eq(payment.membershipId, membershipId))
    .orderBy(desc(payment.createdAt));
}

/**
 * Verify a Stripe Checkout session and activate the membership if paid.
 * Called server-side when the user returns from Stripe with ?payment=success.
 * This handles the case where the webhook hasn't fired yet (e.g., local dev).
 * Idempotent — safe to call multiple times.
 */
export async function verifyAndActivatePayment(
  stripeSessionId: string
): Promise<void> {
  try {
    // Retrieve the session from Stripe to verify payment status
    const stripeSession = await retrieveCheckoutSession(stripeSessionId);

    if (stripeSession.payment_status !== "paid") {
      return; // Not paid yet, do nothing
    }

    const membershipId = stripeSession.metadata?.membershipId;
    if (!membershipId) return;

    // Find the pending payment by Stripe session ID
    const pendingPayment = await db
      .select()
      .from(payment)
      .where(eq(payment.stripeSessionId, stripeSessionId))
      .limit(1);

    // Idempotency: if already succeeded, skip
    if (pendingPayment[0]?.status === "SUCCEEDED") return;

    if (pendingPayment[0]) {
      // Update the pending payment to succeeded
      await db
        .update(payment)
        .set({
          status: "SUCCEEDED",
          stripePaymentIntentId:
            typeof stripeSession.payment_intent === "string"
              ? stripeSession.payment_intent
              : stripeSession.payment_intent?.id ?? null,
          paidAt: new Date(),
        })
        .where(eq(payment.id, pendingPayment[0].id));
    } else {
      // No pending payment found — create one (webhook may have been missed entirely)
      const membershipRecord = await db
        .select()
        .from(membership)
        .where(eq(membership.id, membershipId))
        .limit(1);

      if (membershipRecord[0]) {
        await db.insert(payment).values({
          membershipId,
          amountCents: membershipRecord[0].priceCents,
          method: "STRIPE",
          stripeSessionId,
          stripePaymentIntentId:
            typeof stripeSession.payment_intent === "string"
              ? stripeSession.payment_intent
              : stripeSession.payment_intent?.id ?? null,
          status: "SUCCEEDED",
          paidAt: new Date(),
        });
      }
    }

    // Activate the membership and assign membership number (idempotent)
    await activateAndAssignNumber(membershipId);

    await recordAudit({
      actorId: null,
      actorType: "SYSTEM",
      action: "membership.activate",
      entityType: "membership",
      entityId: membershipId,
      metadata: {
        trigger: "stripe_success_redirect",
        stripeSessionId,
      },
    });
  } catch (error) {
    console.error("Failed to verify Stripe payment:", error);
  }
}
