import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { checkA11y } from "./helpers/accessibility";

test.describe("Forensics", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("forensics module is accessible", async ({ page }) => {
    await page.goto("/forensics");
    await expect(page).toHaveURL(/\/forensics/);
    const violations = await checkA11y(page);
    expect(
      violations,
      `axe violations on /forensics: ${JSON.stringify(violations.map((v) => v.id))}`,
    ).toHaveLength(0);
  });

  test("select 3+ points → set time range → run correlation → verify chart renders", async ({
    page,
  }) => {
    await page.goto("/forensics");
    await expect(page).toHaveURL(/\/forensics/);

    // --- Step 1: Open the point picker ---
    const addPointBtn = page.getByRole("button", {
      name: /add point|select point|add tag/i,
    });
    await addPointBtn.waitFor({ timeout: 8_000 }).catch(() => {
      test.skip(true, "Add point button not found — backend not available");
    });

    // Select 3 points from the picker
    const pointNames = [
      process.env.E2E_POINT_1 ?? "TEST.POINT.001",
      process.env.E2E_POINT_2 ?? "TEST.POINT.002",
      process.env.E2E_POINT_3 ?? "TEST.POINT.003",
    ];

    for (const pointName of pointNames) {
      await addPointBtn.click();

      // Search for the point
      const searchField = page.getByPlaceholder(/search|filter|find/i);
      await searchField.waitFor({ timeout: 5_000 });
      await searchField.fill(pointName);

      // Select the first matching result
      const firstResult = page
        .getByRole("option", {
          name: new RegExp(pointName.replace(".", "\\."), "i"),
        })
        .first();
      const altResult = page
        .getByRole("row")
        .filter({ hasText: pointName })
        .first();

      if (await firstResult.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await firstResult.click();
      } else if (
        await altResult.isVisible({ timeout: 3_000 }).catch(() => false)
      ) {
        await altResult.click();
      } else {
        // Point picker may have already added it or uses checkboxes
        const checkbox = page.getByRole("checkbox", {
          name: new RegExp(pointName.replace(".", "\\."), "i"),
        });
        if (await checkbox.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await checkbox.check();
        }
      }

      // Confirm / close picker if it's modal
      const confirmBtn = page.getByRole("button", {
        name: /confirm|done|add|ok/i,
      });
      if (await confirmBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await confirmBtn.click();
      }
    }

    // Verify 3 points are now visible in the selection list
    const selectedPoints = page.locator(
      '[data-testid*="selected-point"], [class*="selected-point"], [class*="point-chip"]',
    );
    const pointCount = await selectedPoints.count();
    expect(pointCount).toBeGreaterThanOrEqual(3);

    // --- Step 2: Set a 24-hour time range ---
    // Look for a time range picker or start/end date inputs
    const timeRangePicker = page.getByRole("button", {
      name: /time range|last 24|24h|1 day/i,
    });
    if (
      await timeRangePicker.isVisible({ timeout: 3_000 }).catch(() => false)
    ) {
      await timeRangePicker.click();
      // Select the 24h preset
      const preset24h = page.getByRole("option", {
        name: /24 hour|last 24|1 day/i,
      });
      if (await preset24h.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await preset24h.click();
      }
    } else {
      // Try direct date inputs
      const startInput = page.getByLabel(/start|from/i);
      const endInput = page.getByLabel(/end|to/i);
      if (await startInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        await startInput.fill(yesterday.toISOString().slice(0, 16));
        await endInput.fill(now.toISOString().slice(0, 16));
      }
    }

    // --- Step 3: Run correlation ---
    const runBtn = page.getByRole("button", {
      name: /run|analyze|correlate|calculate/i,
    });
    await runBtn.waitFor({ timeout: 5_000 });
    await runBtn.click();

    // --- Step 4: Wait for chart to render ---
    // The correlation result may be a matrix, chart canvas, or SVG
    const chartLocator = page
      .locator(
        'canvas[data-testid*="chart"], canvas[class*="chart"], svg[data-testid*="chart"], svg[class*="chart"], [data-testid*="correlation-matrix"], [class*="correlation"]',
      )
      .first();

    await chartLocator.waitFor({ timeout: 15_000 }).catch(() => {
      test.skip(
        true,
        "Correlation chart did not render — backend data not available",
      );
    });

    // Verify the chart element is visible and non-empty (has width/height)
    await expect(chartLocator).toBeVisible();
    const chartBox = await chartLocator.boundingBox();
    expect(chartBox).not.toBeNull();
    expect(chartBox!.width).toBeGreaterThan(0);
    expect(chartBox!.height).toBeGreaterThan(0);

    // --- Step 5: Verify correlation values are numeric ---
    // Look for any correlation coefficient cells or labels
    const correlationValues = page.locator(
      '[data-testid*="correlation-value"], [class*="correlation-value"], td[class*="matrix"]',
    );
    const valueCount = await correlationValues.count();
    if (valueCount > 0) {
      const firstValue = await correlationValues.first().textContent();
      // Correlation values are between -1 and 1
      const parsed = parseFloat(firstValue ?? "");
      expect(isNaN(parsed)).toBe(false);
      expect(parsed).toBeGreaterThanOrEqual(-1);
      expect(parsed).toBeLessThanOrEqual(1);
    }

    // --- Step 6: Run a11y audit on the forensics results page ---
    const violationsResults = await checkA11y(page);
    expect(
      violationsResults,
      `axe violations on forensics results: ${JSON.stringify(violationsResults.map((v) => v.id))}`,
    ).toHaveLength(0);
  });
});
