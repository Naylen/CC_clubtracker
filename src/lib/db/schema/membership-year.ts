import { integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

export const membershipYear = pgTable("membership_year", {
  id: uuid("id").defaultRandom().primaryKey(),
  year: integer("year").notNull().unique(),
  opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
  renewalDeadline: timestamp("renewal_deadline", { withTimezone: true })
    .notNull(),
  capacityCap: integer("capacity_cap").notNull().default(350),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
