import { db } from "@/lib/db";
import { membership, member } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { calculatePrice } from "@/lib/utils/pricing";

interface SeedRenewalsParams {
  membershipYearId: string;
  year: number;
  previousYearId: string;
}

/**
 * Seed PENDING_RENEWAL memberships for a new year based on
 * all ACTIVE households from the prior year.
 */
export async function seedRenewals(
  params: SeedRenewalsParams
): Promise<number> {
  const { membershipYearId, year, previousYearId } = params;

  const activeMemberships = await db
    .select({ householdId: membership.householdId })
    .from(membership)
    .where(
      and(
        eq(membership.membershipYearId, previousYearId),
        eq(membership.status, "ACTIVE")
      )
    );

  let count = 0;

  for (const m of activeMemberships) {
    const primaryMember = await db
      .select()
      .from(member)
      .where(
        and(
          eq(member.householdId, m.householdId),
          eq(member.role, "PRIMARY")
        )
      )
      .limit(1);

    if (primaryMember.length === 0) continue;

    const primary = primaryMember[0];
    const pricing = calculatePrice({
      dateOfBirth: primary.dateOfBirth,
      isVeteranDisabled: primary.isVeteranDisabled,
      membershipYear: year,
    });

    await db.insert(membership).values({
      householdId: m.householdId,
      membershipYearId,
      status: "PENDING_RENEWAL",
      priceCents: pricing.priceCents,
      discountType: pricing.discountType,
    });

    count++;
  }

  return count;
}
