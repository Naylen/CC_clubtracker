import {
  boolean,
  date,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { membershipYear } from "./membership-year";
import { member } from "./member";

export const signupEventConfig = pgTable("signup_event_config", {
  id: uuid("id").defaultRandom().primaryKey(),
  membershipYearId: uuid("membership_year_id")
    .notNull()
    .unique()
    .references(() => membershipYear.id, { onDelete: "cascade" }),
  eventDate: date("event_date", { mode: "string" }).notNull(),
  eventStartTime: time("event_start_time").notNull(),
  eventEndTime: time("event_end_time").notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  location: text("location")
    .notNull()
    .default("6701 Old Nest Egg Rd, Mt Sterling, KY 40353"),
  notes: text("notes"),
  updatedByAdminId: uuid("updated_by_admin_id")
    .notNull()
    .references(() => member.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
