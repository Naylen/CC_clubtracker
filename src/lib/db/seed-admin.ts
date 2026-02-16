import { db } from "@/lib/db";
import { member, household } from "@/lib/db/schema";
import { user, account } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

/**
 * Seed the initial admin user from environment variables.
 *
 * Reads ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_NAME from the environment.
 * If no admin member exists in the database, creates:
 *   1. A Better Auth user + account (with bcrypt-hashed password)
 *   2. A household for the admin
 *   3. A member record with isAdmin=true and adminRole=SUPER_ADMIN
 *
 * This function is idempotent — if an admin already exists, it does nothing.
 * Uses direct DB inserts (no HTTP calls) to avoid startup timing issues.
 */
export async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Admin";

  if (!email || !password) {
    console.log("[seed-admin] ADMIN_EMAIL or ADMIN_PASSWORD not set, skipping.");
    return;
  }

  // Check if any admin member already exists
  const existingAdmin = await db
    .select()
    .from(member)
    .where(eq(member.isAdmin, true))
    .limit(1);

  if (existingAdmin.length > 0) {
    console.log("[seed-admin] Admin member already exists, skipping seed.");
    return;
  }

  console.log(`[seed-admin] No admin found. Creating initial admin: ${email}`);

  try {
    // Check if Better Auth user already exists
    let authUserId: string;
    const existingUser = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (existingUser[0]) {
      authUserId = existingUser[0].id;
      console.log("[seed-admin] Auth user already exists, reusing.");
    } else {
      // Hash password using Better Auth's internal hashing
      // Better Auth uses bcrypt via the scrypt adapter by default,
      // but we can use the native Node.js crypto for a simple hash
      const { scrypt, randomBytes } = await import("crypto");
      const { promisify } = await import("util");
      const scryptAsync = promisify(scrypt);
      const salt = randomBytes(16).toString("hex");
      const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
      const hashedPassword = `${salt}:${derivedKey.toString("hex")}`;

      // Create Better Auth user directly in DB
      authUserId = randomUUID();
      await db.insert(user).values({
        id: authUserId,
        name,
        email,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create the credential account (Better Auth pattern)
      await db.insert(account).values({
        id: randomUUID(),
        accountId: authUserId,
        providerId: "credential",
        userId: authUserId,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log("[seed-admin] Auth user created.");
    }

    // Check if household already exists for this email
    const existingHousehold = await db
      .select()
      .from(household)
      .where(eq(household.email, email))
      .limit(1);

    let householdId: string;
    if (existingHousehold[0]) {
      householdId = existingHousehold[0].id;
    } else {
      const [adminHousehold] = await db
        .insert(household)
        .values({
          name: `${name} Household`,
          email,
          addressLine1: "N/A",
          city: "Mt Sterling",
          state: "KY",
          zip: "40353",
        })
        .returning({ id: household.id });
      householdId = adminHousehold.id;
    }

    // Create the admin member with SUPER_ADMIN role
    const [adminMember] = await db
      .insert(member)
      .values({
        householdId,
        firstName: name.split(" ")[0] ?? "Admin",
        lastName: name.split(" ").slice(1).join(" ") || "User",
        email,
        dateOfBirth: "1990-01-01",
        role: "PRIMARY",
        isAdmin: true,
        adminRole: "SUPER_ADMIN",
      })
      .returning({ id: member.id });

    console.log(
      `[seed-admin] Admin created: ${email} (member: ${adminMember.id}, role: SUPER_ADMIN)`,
    );
  } catch (error) {
    console.error("[seed-admin] Error seeding admin:", error);
  }
}
