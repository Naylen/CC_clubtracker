import { NextResponse } from "next/server";
import { and, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { broadcastAttachment } from "@/lib/db/schema";
import { validateCronSecret } from "@/lib/utils/cron-auth";
import { recordAudit } from "@/lib/utils/audit";

/**
 * Delete orphaned draft attachments — rows still tied to a draft_id 7+
 * days after upload, meaning their broadcast was never sent or scheduled
 * (admin closed the compose tab, abandoned the form, etc.).
 *
 * Idempotent: re-running on the same window deletes nothing.
 *
 * Add to the host cron alongside the other jobs, e.g. daily at 09:00 UTC:
 *   0 9 * * * curl -sf -X POST -H "x-cron-secret: $CRON_SECRET" \
 *     http://localhost:3001/api/cron/cleanup-attachments
 */
export async function POST(request: Request) {
  const authError = validateCronSecret(request);
  if (authError) return authError;

  try {
    const deleted = await db
      .delete(broadcastAttachment)
      .where(
        and(
          isNotNull(broadcastAttachment.draftId),
          lt(broadcastAttachment.createdAt, sql`now() - interval '7 days'`),
        ),
      )
      .returning({ id: broadcastAttachment.id });

    const count = deleted.length;
    console.log(`[cron] cleanup-attachments: deleted ${count} orphan(s)`);

    if (count > 0) {
      await recordAudit({
        actorId: null,
        actorType: "SYSTEM",
        action: "system.broadcast_attachment_sweep",
        entityType: "system",
        entityId: "00000000-0000-0000-0000-000000000000",
        metadata: { deletedCount: count },
      });
    }

    return NextResponse.json({ success: true, deleted: count });
  } catch (error) {
    console.error("[cron] cleanup-attachments failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
