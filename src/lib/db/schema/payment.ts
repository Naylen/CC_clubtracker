import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { membership } from "./membership";
import { member } from "./member";

export const paymentMethodEnum = pgEnum("payment_method", [
  "STRIPE",
  "CASH",
  "CHECK",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "SUCCEEDED",
  "FAILED",
  "REFUNDED",
]);

export const payment = pgTable("payment", {
  id: uuid("id").defaultRandom().primaryKey(),
  membershipId: uuid("membership_id")
    .notNull()
    .references(() => membership.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  method: paymentMethodEnum("method").notNull(),
  stripeSessionId: text("stripe_session_id").unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  checkNumber: text("check_number"),
  recordedByAdminId: uuid("recorded_by_admin_id").references(
    () => member.id
  ),
  status: paymentStatusEnum("status").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
