import {
  integer,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { household } from "./household";
import { membershipYear } from "./membership-year";
import { membershipTier } from "./membership-tier";

export const membershipStatusEnum = pgEnum("membership_status", [
  "PENDING_RENEWAL",
  "ACTIVE",
  "LAPSED",
  "NEW_PENDING",
]);

export const discountTypeEnum = pgEnum("discount_type", [
  "NONE",
  "VETERAN",
  "SENIOR",
]);

export const membership = pgTable(
  "membership",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    membershipYearId: uuid("membership_year_id")
      .notNull()
      .references(() => membershipYear.id, { onDelete: "cascade" }),
    status: membershipStatusEnum("status").notNull(),
    priceCents: integer("price_cents").notNull(),
    discountType: discountTypeEnum("discount_type").notNull().default("NONE"),
    membershipTierId: uuid("membership_tier_id").references(
      () => membershipTier.id,
      { onDelete: "set null" }
    ),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }),
    lapsedAt: timestamp("lapsed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("membership_household_year_unique").on(
      table.householdId,
      table.membershipYearId
    ),
  ]
);
