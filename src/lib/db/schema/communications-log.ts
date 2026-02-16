import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { member } from "./member";

export const communicationsLog = pgTable("communications_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  recipientFilter: jsonb("recipient_filter").notNull(),
  recipientCount: integer("recipient_count").notNull(),
  sentByAdminId: uuid("sent_by_admin_id")
    .notNull()
    .references(() => member.id),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
  resendBatchId: text("resend_batch_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
