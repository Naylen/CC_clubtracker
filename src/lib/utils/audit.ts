import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";
import type { ActorType } from "@/types";

interface AuditEntry {
  actorId: string | null;
  actorType: ActorType;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Record an entry in the audit log.
 *
 * BR-9: Every state-changing action performed by an admin must be recorded.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    actorId: entry.actorId,
    actorType: entry.actorType,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    metadata: entry.metadata ?? null,
  });
}
