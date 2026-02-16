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

/**
 * Admin role hierarchy for RBAC:
 * - SUPER_ADMIN: Full access, can manage other admins. Seeded from .env.
 * - ADMIN: Full operational access (members, years, payments, broadcasts).
 * - OFFICER: Limited access (view members, manage sign-up day, view payments).
 */
export const adminRoleEnum = pgEnum("admin_role", [
  "SUPER_ADMIN",
  "ADMIN",
  "OFFICER",
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
  adminRole: adminRoleEnum("admin_role"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  driverLicenseEncrypted: text("driver_license_encrypted"),
  veteranDocEncrypted: text("veteran_doc_encrypted"),
  veteranDocFilename: text("veteran_doc_filename"),
  veteranDocMimeType: text("veteran_doc_mime_type"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
