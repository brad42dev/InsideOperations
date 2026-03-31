import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { checkA11y } from "./helpers/accessibility";

test.describe("Dashboards", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("dashboards page is accessible", async ({ page }) => {
    await page.goto("/dashboards");
    await expect(page).toHaveURL(/\/dashboards/);
    const violations = await checkA11y(page);
    expect(
      violations,
      `axe violations on /dashboards: ${JSON.stringify(violations.map((v) => v.id))}`,
    ).toHaveLength(0);
  });

  test("dashboards list loads", async ({ page }) => {
    await page.goto("/dashboards");
    await expect(page).toHaveURL(/\/dashboards/);
  });
});
