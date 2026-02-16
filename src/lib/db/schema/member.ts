import {
  boolean,
  date,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { household } from "./household";

export const memberRoleEnum = pgEnum("member_role", [
  "PRIMARY",
  "DEPENDENT",
]);

export const member = pgTable("member", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => household.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").unique(),
  dateOfBirth: date("date_of_birth", { mode: "string" }).notNull(),
  role: memberRoleEnum("role").notNull(),
  isVeteranDisabled: boolean("is_veteran_disabled").notNull().default(false),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
