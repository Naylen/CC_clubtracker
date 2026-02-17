import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import { db } from "@/lib/db";
import { payment, membership } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { recordAudit } from "@/lib/utils/audit";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const membershipId = session.metadata?.membershipId;

    if (!membershipId) {
      console.error("No membershipId in session metadata");
      return NextResponse.json({ received: true });
    }

    // BR-10: Idempotency check — skip if already processed
    const existingPayment = await db
      .select()
      .from(payment)
      .where(eq(payment.stripeSessionId, session.id))
      .limit(1);

    if (existingPayment[0]?.status === "SUCCEEDED") {
      // Already processed, return 200 with no side effects
      return NextResponse.json({ received: true });
    }

    // Update or create payment record
    if (existingPayment[0]) {
      // Update the pending payment
      await db
        .update(payment)
        .set({
          stripeSessionId: session.id,
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
          status: "SUCCEEDED",
          paidAt: new Date(),
        })
        .where(eq(payment.id, existingPayment[0].id));
    } else {
      // Create a new payment record (webhook arrived before redirect)
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
          stripeSessionId: session.id,
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
          status: "SUCCEEDED",
          paidAt: new Date(),
        });
      }
    }

    // Activate the membership + assign membership number (only if in payable state — M7)
    const { activateAndAssignNumber } = await import(
      "@/lib/utils/membership-number"
    );

    // Verify membership is in a payable state before activating
    const membershipCheck = await db
      .select({ status: membership.status })
      .from(membership)
      .where(eq(membership.id, membershipId))
      .limit(1);

    const payableStatuses = ["NEW_PENDING", "PENDING_RENEWAL", "ACTIVE"];
    if (
      membershipCheck[0] &&
      payableStatuses.includes(membershipCheck[0].status)
    ) {
      const activationResult = await activateAndAssignNumber(membershipId);

      await recordAudit({
        actorId: null,
        actorType: "SYSTEM",
        action: "membership.activate",
        entityType: "membership",
        entityId: membershipId,
        metadata: {
          trigger: "stripe_webhook",
          stripeSessionId: session.id,
          membershipNumber: activationResult?.membershipNumber,
          memberName: activationResult?.memberName,
        },
      });
    }

    console.log(
      JSON.stringify({
        action: "webhook.checkout_completed",
        membershipId,
        stripeSessionId: session.id,
      })
    );
  }

  return NextResponse.json({ received: true });
}
