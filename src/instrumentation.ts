/**
 * Next.js Instrumentation Hook
 *
 * Runs once when the server starts. Used here to:
 * 1. Push the Drizzle schema to the database (ensuring tables exist)
 * 2. Seed the initial admin user from environment variables
 *
 * The schema push uses drizzle-kit to sync the schema with the database,
 * which is safe for dev. In production, use proper migrations.
 */
export async function register() {
  // Only run on the server (not during build or in edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Wait for the DB to be ready (Docker startup)
    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      // Run drizzle-kit push to ensure schema is up to date
      console.log("[init] Pushing database schema...");
      const { execSync } = await import("child_process");
      execSync("npx drizzle-kit push --force", {
        stdio: "inherit",
        env: { ...process.env },
      });
      console.log("[init] Schema push complete.");
    } catch (error) {
      console.error("[init] Schema push failed:", error);
      // Don't fail startup — the schema might already be up to date
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
