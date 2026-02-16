import { db } from "@/lib/db";
import { membership } from "@/lib/db/schema";
import { eq, inArray, sql, and } from "drizzle-orm";

interface CapacityResult {
  occupied: number;
  cap: number;
  available: number;
  isFull: boolean;
}

/**
 * Check current capacity for a membership year.
 *
 * BR-1: Active + pending memberships per year ≤ capacityCap.
 * Uses SELECT ... FOR UPDATE for concurrency-safe enrollment.
 *
 * IMPORTANT: This must be called inside a transaction to be effective.
 * The FOR UPDATE lock ensures two concurrent enrollments cannot both
 * succeed past the cap.
 */
export async function checkCapacity(
  membershipYearId: string,
  capacityCap: number
): Promise<CapacityResult> {
  const countStatuses = ["ACTIVE", "PENDING_RENEWAL", "NEW_PENDING"] as const;

  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS occupied
    FROM ${membership}
    WHERE ${membership.membershipYearId} = ${membershipYearId}
      AND ${membership.status} IN (${sql.join(
        countStatuses.map((s) => sql`${s}`),
        sql`, `
      )})
    FOR UPDATE
  `);

  const occupied = (result.rows[0] as { occupied: number }).occupied;

  return {
    occupied,
    cap: capacityCap,
    available: Math.max(0, capacityCap - occupied),
    isFull: occupied >= capacityCap,
  };
}

/**
 * Get capacity count without locking (for display purposes only).
 */
export async function getCapacityDisplay(
  membershipYearId: string,
  capacityCap: number
): Promise<CapacityResult> {
  const result = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(membership)
    .where(
      and(
        eq(membership.membershipYearId, membershipYearId),
        inArray(membership.status, [
          "ACTIVE",
          "PENDING_RENEWAL",
          "NEW_PENDING",
        ])
      )
    );

  const occupied = result[0]?.count ?? 0;

  return {
    occupied,
    cap: capacityCap,
    available: Math.max(0, capacityCap - occupied),
    isFull: occupied >= capacityCap,
  };
}
