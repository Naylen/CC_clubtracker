/**
 * Next.js Instrumentation Hook
 *
 * Runs once when the server starts. Used here to:
 * 1. Run Drizzle migrations to ensure all tables exist
 * 2. Seed the initial admin user from environment variables
 * 3. Seed default membership tiers
 *
 * Uses `drizzle-kit migrate` (generated SQL migrations) instead of
 * `drizzle-kit push` to avoid interactive prompts that block Docker
 * startup. Migrations are idempotent — already-applied migrations
 * are skipped automatically.
 *
 * To add new schema changes:
 *   1. Edit the schema files in src/lib/db/schema/
 *   2. Run: docker compose exec app pnpm drizzle-kit generate
 *   3. Commit the generated migration file in src/lib/db/migrations/
 *   4. Restart the app — migrations apply automatically
 */
export async function register() {
  // Only run on the server (not during build or in edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Wait for the DB to be ready (Docker startup)
    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      console.log("[init] Running database migrations...");
      const { execSync } = await import("child_process");
      execSync("pnpm drizzle-kit migrate", {
        stdio: ["pipe", "inherit", "inherit"],
        env: { ...process.env },
        timeout: 60000,
      });
      console.log("[init] Migrations complete.");
    } catch (error) {
      console.error("[init] Migration failed:", error);
    }

    // Seed admin — retry with backoff since the auth API may not be ready
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { seedAdmin } = await import("@/lib/db/seed-admin");
        await seedAdmin();
        break; // Success
      } catch (error) {
        if (attempt === maxRetries) {
          console.error("[init] Admin seed failed after retries:", error);
        } else {
          console.log(
            `[init] Admin seed attempt ${attempt} failed, retrying in ${attempt * 2}s...`,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, attempt * 2000),
          );
        }
      }
    }

    // Seed default membership tiers
    try {
      const { seedMembershipTiers } = await import(
        "@/lib/db/seed-membership-tiers"
      );
      await seedMembershipTiers();
    } catch (error) {
      console.error("[init] Membership tier seed failed:", error);
    }
  }
}
