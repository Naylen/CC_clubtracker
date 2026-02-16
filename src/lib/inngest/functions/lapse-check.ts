import { inngest } from "../client";
import { db } from "@/lib/db";
import { membership, membershipYear } from "@/lib/db/schema";
import { eq, and, lte } from "drizzle-orm";
import { recordAudit } from "@/lib/utils/audit";

/**
 * BR-2: Renewal Deadline Enforcement
 *
 * Cron: Feb 1 at 05:00 UTC (00:00 ET)
 * Transitions all PENDING_RENEWAL memberships to LAPSED for years
 * whose renewal_deadline has passed.
 */
export const lapseCheck = inngest.createFunction(
  { id: "lapse-check", name: "Lapse Expired Renewals" },
  { cron: "0 5 1 2 *" },
  async ({ step }) => {
    const lapsedCount = await step.run("lapse-pending-renewals", async () => {
      // Find membership years whose deadline has passed
      const expiredYears = await db
        .select({ id: membershipYear.id })
        .from(membershipYear)
        .where(lte(membershipYear.renewalDeadline, new Date()));

      if (expiredYears.length === 0) return 0;

      let totalLapsed = 0;

      for (const year of expiredYears) {
        const result = await db
          .update(membership)
          .set({
            status: "LAPSED",
            lapsedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(membership.membershipYearId, year.id),
              eq(membership.status, "PENDING_RENEWAL")
            )
          )
          .returning({ id: membership.id });

        totalLapsed += result.length;

        // Audit each lapsed membership
        for (const row of result) {
          await recordAudit({
            actorId: null,
            actorType: "SYSTEM",
            action: "membership.lapse",
            entityType: "membership",
            entityId: row.id,
            metadata: { reason: "renewal_deadline_passed" },
          });
        }
      }

      return totalLapsed;
    });

    return { lapsedCount };
  }
);
