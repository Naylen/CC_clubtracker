import { db } from "@/lib/db";
import { membershipTier } from "@/lib/db/schema";

/**
 * Seed default membership tiers if none exist.
 *
 * Creates three tiers:
 * - Standard: $150
 * - Senior (65+): $100
 * - Disabled Veteran: $100
 *
 * This function is idempotent — if any tiers already exist, it does nothing.
 */
export async function seedMembershipTiers(): Promise<void> {
  const existing = await db.select().from(membershipTier).limit(1);

  if (existing.length > 0) {
    console.log(
      "[seed-tiers] Membership tiers already exist, skipping seed."
    );
    return;
  }

  console.log("[seed-tiers] No membership tiers found. Creating defaults...");

  await db.insert(membershipTier).values([
    {
      name: "Standard",
      description: "Standard annual membership",
      priceCents: 15000,
      isActive: true,
      sortOrder: 0,
    },
    {
      name: "Senior (65+)",
      description: "Discounted rate for members age 65 and older",
      priceCents: 10000,
      isActive: true,
      sortOrder: 1,
    },
    {
      name: "Disabled Veteran",
      description: "Discounted rate for disabled veterans",
      priceCents: 10000,
      isActive: true,
      sortOrder: 2,
    },
  ]);

  console.log("[seed-tiers] Default membership tiers created.");
}
