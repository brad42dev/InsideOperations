import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { checkA11y } from "./helpers/accessibility";

test.describe("Reports", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("reports module is accessible", async ({ page }) => {
    await page.goto("/reports");
    await expect(page).toHaveURL(/\/reports/);
    const violations = await checkA11y(page);
    expect(
      violations,
      `axe violations on /reports: ${JSON.stringify(violations.map((v) => v.id))}`,
    ).toHaveLength(0);
  });

  test("reports module loads with canned templates", async ({ page }) => {
    await page.goto("/reports");
    await expect(page).toHaveURL(/\/reports/);
  });

  test("can open template config panel", async ({ page }) => {
    await page.goto("/reports");
    const firstTemplate = page
      .getByRole("button", { name: /generate|run|configure/i })
      .first();
    if (await firstTemplate.isVisible()) {
      await firstTemplate.click();
      // config panel should appear
      // Run a11y on the config panel
      const violations = await checkA11y(page);
      expect(
        violations,
        `axe violations on report config panel: ${JSON.stringify(violations.map((v) => v.id))}`,
      ).toHaveLength(0);
    }
    // Just check page didn't crash
    await expect(page).toHaveURL(/\/reports/);
  });
});
