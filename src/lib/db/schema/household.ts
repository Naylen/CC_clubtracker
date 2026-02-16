import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const household = pgTable("household", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: text("city").notNull(),
  state: text("state").notNull().default("KY"),
  zip: text("zip").notNull(),
  phone: text("phone"),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
