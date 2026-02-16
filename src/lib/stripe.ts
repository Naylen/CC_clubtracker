import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

interface CreateCheckoutParams {
  membershipId: string;
  householdName: string;
  amountCents: number;
  membershipYear: number;
  customerEmail: string;
}

/**
 * Create a Stripe Checkout session for membership renewal or new enrollment.
 */
export async function createCheckoutSession(
  params: CreateCheckoutParams
): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: params.customerEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `MCFGC ${params.membershipYear} Membership`,
            description: `Annual membership for ${params.householdName}`,
          },
          unit_amount: params.amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      membershipId: params.membershipId,
    },
    success_url: `${process.env.BETTER_AUTH_URL}/member/dashboard?payment=success`,
    cancel_url: `${process.env.BETTER_AUTH_URL}/member/dashboard?payment=cancelled`,
  });

  return session.url!;
}

/**
 * Verify and construct a Stripe webhook event from the raw body.
 */
export function constructWebhookEvent(
  rawBody: string,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}
