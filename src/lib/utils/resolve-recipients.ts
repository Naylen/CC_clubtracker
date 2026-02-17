import { db } from "@/lib/db";
import { membership, household, membershipYear } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { RecipientFilter } from "@/types";

/**
 * Resolve recipient emails based on a filter.
 */
export async function resolveRecipients(
  filter: RecipientFilter
): Promise<string[]> {
  let yearId: string | undefined;
  if (filter.year) {
    const year = await db
      .select()
      .from(membershipYear)
      .where(eq(membershipYear.year, filter.year))
      .limit(1);
    yearId = year[0]?.id;
  } else {
    const currentYear = new Date().getFullYear();
    const year = await db
      .select()
      .from(membershipYear)
      .where(eq(membershipYear.year, currentYear))
      .limit(1);
    yearId = year[0]?.id;
  }

  if (!yearId) return [];

  let query = db
    .select({ email: household.email })
    .from(membership)
    .innerJoin(household, eq(membership.householdId, household.id))
    .where(eq(membership.membershipYearId, yearId));

  if (filter.status) {
    query = db
      .select({ email: household.email })
      .from(membership)
      .innerJoin(household, eq(membership.householdId, household.id))
      .where(
        and(
          eq(membership.membershipYearId, yearId),
          eq(membership.status, filter.status)
        )
      );
  }

  const results = await query;
  return results.map((r) => r.email);
}
