import { db } from "@/lib/db";
import { membership } from "@/lib/db/schema";
import { eq, inArray, sql, and, type SQL } from "drizzle-orm";

/** Minimal interface shared by `db` and `PgTransaction` for raw SQL execution. */
interface DbExecutor {
  execute(query: SQL): Promise<unknown>;
}

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
 * IMPORTANT: Pass a transaction executor (`tx`) so the FOR UPDATE lock
 * is held for the duration of the transaction. Without a transaction
 * the lock is released immediately and the check is not concurrency-safe.
 */
export async function checkCapacity(
  membershipYearId: string,
  capacityCap: number,
  executor: DbExecutor = db,
): Promise<CapacityResult> {
  const countStatuses = ["ACTIVE", "PENDING_RENEWAL", "NEW_PENDING"] as const;

  const result = await executor.execute(sql`
    SELECT COUNT(*)::int AS occupied
    FROM ${membership}
    WHERE ${membership.membershipYearId} = ${membershipYearId}
      AND ${membership.status} IN (${sql.join(
        countStatuses.map((s) => sql`${s}`),
        sql`, `,
      )})
    FOR UPDATE
  `);

  const rows = result as unknown as { occupied: number }[];
  const occupied = rows[0]?.occupied ?? 0;

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
  capacityCap: number,
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
        ]),
      ),
    );

  const occupied = result[0]?.count ?? 0;

  return {
    occupied,
    cap: capacityCap,
    available: Math.max(0, capacityCap - occupied),
    isFull: occupied >= capacityCap,
  };
}
