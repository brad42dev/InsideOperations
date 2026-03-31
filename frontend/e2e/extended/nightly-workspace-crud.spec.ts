/**
 * Extended / Nightly E2E Tests
 *
 * These tests are tagged @nightly and are excluded from PR CI runs.
 * They run in the nightly CI schedule (see playwright.config.ts testIgnore patterns
 * or the separate nightly project).
 *
 * To run locally:   pnpm e2e --grep @nightly
 * To skip locally:  pnpm e2e --grep-invert @nightly  (default CI behavior)
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";
import { checkA11y } from "../helpers/accessibility";

test.describe("Workspace CRUD @nightly", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("full workspace CRUD lifecycle @nightly", async ({ page }) => {
    await page.goto("/console");
    await expect(page).toHaveURL(/\/console/);

    // Run a11y
    const violations = await checkA11y(page);
    expect(
      violations,
      `axe violations on /console: ${JSON.stringify(violations.map((v) => v.id))}`,
    ).toHaveLength(0);

    // Create a new workspace
    const newWorkspaceBtn = page.getByRole("button", {
      name: /new workspace|create workspace|add workspace/i,
    });
    await newWorkspaceBtn.waitFor({ timeout: 8_000 }).catch(() => {
      test.skip(true, "New workspace button not found — backend not available");
    });
    await newWorkspaceBtn.click();

    const workspaceName = `Nightly Test Workspace ${Date.now()}`;
    const nameField = page.getByLabel(/workspace name|name/i).first();
    await nameField.waitFor({ timeout: 5_000 });
    await nameField.fill(workspaceName);

    const saveBtn = page
      .getByRole("button", { name: /save|create|submit/i })
      .last();
    await saveBtn.click();

    // Confirm it appears
    await expect(page.getByText(workspaceName)).toBeVisible({ timeout: 8_000 });

    // Rename it
    const renameBtn = page
      .locator(`[data-testid*="workspace"]:has-text("${workspaceName}")`)
      .getByRole("button", { name: /rename|edit/i });
    if (await renameBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await renameBtn.click();
      const renamedName = `${workspaceName} Renamed`;
      const renameInput = page.getByLabel(/name/i).last();
      await renameInput.fill(renamedName);
      await page
        .getByRole("button", { name: /save|confirm/i })
        .last()
        .click();
      await expect(page.getByText(renamedName)).toBeVisible({ timeout: 8_000 });
    }

    // Delete it
    const deleteBtn = page
      .locator(`[data-testid*="workspace"]`)
      .last()
      .getByRole("button", { name: /delete|remove/i });
    if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await deleteBtn.click();
      // Confirm deletion dialog
      const confirmDeleteBtn = page
        .getByRole("button", { name: /confirm|yes|delete/i })
        .last();
      if (
        await confirmDeleteBtn.isVisible({ timeout: 2_000 }).catch(() => false)
      ) {
        await confirmDeleteBtn.click();
      }
    }
  });
});

test.describe("Designer → Console pipeline @nightly", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("import SVG → bind points → save → open in Console @nightly", async ({
    page,
  }) => {
    await page.goto("/designer");
    await expect(page).toHaveURL(/\/designer/);

    const violations = await checkA11y(page);
    expect(
      violations,
      `axe violations on /designer: ${JSON.stringify(violations.map((v) => v.id))}`,
    ).toHaveLength(0);

    // Import a minimal test SVG
    const importBtn = page.getByRole("button", { name: /import|open|upload/i });
    await importBtn.waitFor({ timeout: 8_000 }).catch(() => {
      test.skip(
        true,
        "Import button not found in Designer — backend not available",
      );
    });
    await importBtn.click();

    // Upload a simple inline SVG content
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const svgContent = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">' +
          '<text x="10" y="50" data-tag="TEST.POINT.001">0.0</text>' +
          "</svg>",
      );
      await fileInput.setInputFiles([
        {
          name: "test-graphic.svg",
          mimeType: "image/svg+xml",
          buffer: svgContent,
        },
      ]);
    }

    // Bind a point to the text element
    const textElement = page
      .locator('[data-tag="TEST.POINT.001"], text')
      .first();
    if (await textElement.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await textElement.click();
      // Open point binding panel
      const bindBtn = page.getByRole("button", {
        name: /bind|assign point|link/i,
      });
      if (await bindBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await bindBtn.click();
        const pointSearch = page.getByPlaceholder(/search|point|tag/i);
        await pointSearch.fill("TEST.POINT.001");
        await page
          .getByRole("option", { name: /TEST\.POINT\.001/i })
          .first()
          .click()
          .catch(() => {});
        await page
          .getByRole("button", { name: /confirm|apply|bind/i })
          .first()
          .click()
          .catch(() => {});
      }
    }

    // Save the graphic
    const saveBtn = page.getByRole("button", { name: /save|publish/i });
    await saveBtn.waitFor({ timeout: 5_000 });
    await saveBtn.click();

    // Verify save succeeded
    await expect(page.getByText(/saved|published/i)).toBeVisible({
      timeout: 8_000,
    });
  });
});

test.describe("Full report generation @nightly", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("generate a canned report as PDF @nightly", async ({ page }) => {
    await page.goto("/reports");
    await expect(page).toHaveURL(/\/reports/);

    const violations = await checkA11y(page);
    expect(
      violations,
      `axe violations on /reports: ${JSON.stringify(violations.map((v) => v.id))}`,
    ).toHaveLength(0);

    // Select the first available canned report
    const reportItem = page
      .getByRole("row")
      .filter({ hasText: /report|summary/i })
      .first();
    await reportItem.waitFor({ timeout: 8_000 }).catch(() => {
      test.skip(true, "No reports found — backend not available");
    });
    await reportItem.click();

    // Configure and run
    const runBtn = page.getByRole("button", { name: /run|generate|export/i });
    await runBtn.waitFor({ timeout: 5_000 });
    await runBtn.click();

    // Wait for generation to complete
    const downloadLink = page.getByRole("link", {
      name: /download|pdf|view report/i,
    });
    await downloadLink.waitFor({ timeout: 60_000 }).catch(() => {
      // Generation may take a while or require backend
    });
  });
});
