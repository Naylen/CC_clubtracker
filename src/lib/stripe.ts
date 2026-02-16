import Stripe from "stripe";

/**
 * Resolve the public-facing app URL for Stripe redirects.
 * Uses BETTER_AUTH_URL (always set in production via setup.sh).
 */
function getAppURL(): string {
  return (
    process.env.BETTER_AUTH_URL ??
    (process.env.APP_DOMAIN
      ? `https://${process.env.APP_DOMAIN}`
      : "http://localhost:3001")
  );
}

/**
 * Lazy-initialized Stripe client.
 * Deferred so the module can be imported at build time without
 * STRIPE_SECRET_KEY being present in the environment.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-01-28.clover",
    });
  }
  return _stripe;
}

interface CreateCheckoutParams {
  membershipId: string;
  householdName: string;
  amountCents: number;
  membershipYear: number;
  customerEmail: string;
}

/**
 * Create a Stripe Checkout session for membership renewal or new enrollment.
 * Returns both the checkout URL and the Stripe session ID.
 */
export async function createCheckoutSession(
  params: CreateCheckoutParams
): Promise<{ url: string; sessionId: string }> {
  const session = await getStripe().checkout.sessions.create({
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
    success_url: `${getAppURL()}/member/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getAppURL()}/member/dashboard?payment=cancelled`,
  });

  return { url: session.url!, sessionId: session.id };
}

/**
 * Retrieve a Stripe Checkout session to verify payment status.
 */
export async function retrieveCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.retrieve(sessionId);
}

/**
 * Verify and construct a Stripe webhook event from the raw body.
 */
export function constructWebhookEvent(
  rawBody: string,
  signature: string
): Stripe.Event {
  return getStripe().webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}
