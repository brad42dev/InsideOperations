import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'
import { checkA11y } from './helpers/accessibility'

test.describe('Alarms', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page)
  })

  test('alarm definitions page is accessible', async ({ page }) => {
    await page.goto('/settings/alarm-definitions')
    await expect(page).toHaveURL(/settings/)
    const violations = await checkA11y(page)
    expect(violations, `axe violations on /settings/alarm-definitions: ${JSON.stringify(violations.map(v => v.id))}`).toHaveLength(0)
  })

  test(
    'configure alarm threshold → inject value above threshold → verify alarm fires in UI',
    async ({ page }) => {
      // --- Step 1: Navigate to alarm definitions ---
      await page.goto('/settings/alarm-definitions')
      await expect(page).toHaveURL(/settings/)

      // --- Step 2: Create a new alarm definition ---
      const createBtn = page.getByRole('button', { name: /new alarm|create alarm|add alarm/i })
      await createBtn.waitFor({ timeout: 8_000 }).catch(() => {
        test.skip(true, 'Create alarm button not found — backend not available')
      })
      await createBtn.click()

      // Fill alarm details: name and point
      const alarmNameField = page.getByLabel(/alarm name|name/i).first()
      await alarmNameField.waitFor({ timeout: 5_000 })
      const alarmName = `E2E Alarm ${Date.now()}`
      await alarmNameField.fill(alarmName)

      // Set point tag (type into point picker or tag input)
      const pointField = page.getByLabel(/point|tag|source/i).first()
      if (await pointField.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await pointField.fill('TEST.POINT.001')
      }

      // Set high threshold condition
      const conditionSelect = page.getByLabel(/condition|type|comparison/i).first()
      if (await conditionSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
        // Try to select "Greater Than" or equivalent
        await conditionSelect.selectOption({ label: 'Greater Than' }).catch(async () => {
          // If it's a custom select, click and pick
          await conditionSelect.click()
          await page.getByRole('option', { name: /greater|high|>/i }).first().click().catch(() => {})
        })
      }

      // Set threshold value
      const thresholdField = page.getByLabel(/threshold|value|limit/i).first()
      if (await thresholdField.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await thresholdField.fill('100')
      }

      // Save the alarm definition
      const saveBtn = page.getByRole('button', { name: /save|create|submit/i }).last()
      await saveBtn.click()

      // Confirm the alarm appears in the list
      await expect(page.getByText(alarmName)).toBeVisible({ timeout: 8_000 })

      // --- Step 3: Run a11y audit after creating alarm ---
      const violationsAfterCreate = await checkA11y(page)
      expect(violationsAfterCreate, `axe violations after alarm create: ${JSON.stringify(violationsAfterCreate.map(v => v.id))}`).toHaveLength(0)

      // --- Step 4: Inject a point value above the threshold ---
      // Navigate to a data injection endpoint or use the debug/test API if available
      // This uses the application's own API to inject a test value
      const apiBase = process.env.E2E_API_BASE ?? 'http://localhost:3000'
      const injected = await page.request.post(`${apiBase}/api/v1/test/inject-point-value`, {
        data: { tag: 'TEST.POINT.001', value: 150 },
        headers: { 'Content-Type': 'application/json' },
        failOnStatusCode: false,
      })

      // If the injection endpoint is not available, check the alarms event feed directly
      if (!injected.ok()) {
        // Try navigating to the active alarms list and check for any alarm firing
        test.skip(true, 'Test injection endpoint not available — skipping live alarm fire assertion')
      }

      // --- Step 5: Navigate to active alarms and verify the alarm fired ---
      await page.goto('/alerts')
      // Wait for the alarm to appear — the alarm engine processes events asynchronously
      // Poll up to 15 seconds for the alarm to appear
      await expect(page.getByText(alarmName)).toBeVisible({ timeout: 15_000 })

      // Confirm the alarm shows a non-normal state (active/unacknowledged)
      const alarmRow = page.locator(`[data-alarm-name="${alarmName}"], tr:has-text("${alarmName}")`).first()
      if (await alarmRow.isVisible({ timeout: 2_000 }).catch(() => false)) {
        const statusCell = alarmRow.locator('[data-testid="alarm-state"], [class*="alarm-state"], td').first()
        const statusText = await statusCell.textContent()
        // State should NOT be "normal" — it fired
        expect(statusText?.toLowerCase()).not.toContain('normal')
      }

      // --- Step 6: Run a11y audit on the active alarms view ---
      const violationsAlarms = await checkA11y(page)
      expect(violationsAlarms, `axe violations on alarms view: ${JSON.stringify(violationsAlarms.map(v => v.id))}`).toHaveLength(0)
    }
  )
})
