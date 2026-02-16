import { test, expect } from "@playwright/test";

test.describe("Admin Roster Management", () => {
  test.beforeEach(async () => {
    // TODO: Seed admin user and log in
  });

  test("admin can navigate to households page", async ({ page }) => {
    await page.goto("/admin/households");
    await expect(page.locator("h2")).toContainText("Households");
  });

  test("admin can navigate to new household form", async ({ page }) => {
    await page.goto("/admin/households/new");
    await expect(page.locator("h2")).toContainText("Add Household");
  });

  test("admin can view dashboard", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page.locator("h2")).toContainText("Dashboard");
  });
});
