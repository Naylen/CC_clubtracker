import { test, expect } from "@playwright/test";

test.describe("Renewal Flow", () => {
  test("member can access magic link page", async ({ page }) => {
    await page.goto("/magic-link");
    await expect(page.locator("h1")).toContainText("MCFGC");
    await expect(page.locator("text=Member Portal")).toBeVisible();
  });

  test("login page is accessible", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1")).toContainText("MCFGC");
    await expect(page.locator("text=Admin Sign In")).toBeVisible();
  });
});
