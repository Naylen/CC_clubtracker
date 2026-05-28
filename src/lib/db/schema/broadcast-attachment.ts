import {
  boolean,
  customType,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { member } from "./member";
import { communicationsLog } from "./communications-log";

// Drizzle's pg-core lacks a first-class bytea type. This custom type maps
// Node Buffer ↔ Postgres bytea so attachment binary lives alongside metadata
// in one row, matching the same on-disk-free pattern used for veteran docs.
const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return "bytea";
  },
});

/**
 * Binary blobs (images + files) attached to broadcasts.
 *
 * Two phases:
 *   1. Compose — admin uploads while filling out the broadcast form. Row is
 *      tied to a client-generated `draft_id` (uuid). `communications_log_id`
 *      is NULL.
 *   2. Send/schedule — when sendBroadcast/updateScheduledBroadcast runs, all
 *      rows for that draftId are re-linked: draft_id → NULL,
 *      communications_log_id → the new (or existing) broadcast row.
 *
 * Inline images (is_inline = true) are rendered with cid:att-{id} at send
 * time; the body is rewritten to swap the in-app preview URL for the cid:
 * reference. Non-inline files travel as MIME attachments.
 *
 * Orphan sweep: rows that still have draft_id IS NOT NULL after 7 days are
 * deleted by the cleanup cron — covers abandoned drafts.
 */
export const broadcastAttachment = pgTable("broadcast_attachment", {
  id: uuid("id").defaultRandom().primaryKey(),
  draftId: uuid("draft_id"),
  communicationsLogId: uuid("communications_log_id").references(
    () => communicationsLog.id,
    { onDelete: "cascade" },
  ),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  // true = embedded in body via cid:att-{id}; false = file attachment
  isInline: boolean("is_inline").notNull().default(false),
  data: bytea("data").notNull(),
  createdByAdminId: uuid("created_by_admin_id")
    .notNull()
    .references(() => member.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
