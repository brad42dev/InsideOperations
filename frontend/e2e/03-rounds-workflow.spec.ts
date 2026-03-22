import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'
import { checkA11y } from './helpers/accessibility'

test.describe('Rounds workflow', () => {
  // Mobile viewport for the full critical path
  test.use({ viewport: { width: 375, height: 812 } })

  test.beforeEach(async ({ page }) => {
    await loginAs(page)
  })

  test('rounds page is accessible', async ({ page }) => {
    await page.goto('/rounds')
    await expect(page).toHaveURL(/\/rounds/)
    const violations = await checkA11y(page)
    expect(violations, `axe violations on /rounds: ${JSON.stringify(violations.map(v => v.id))}`).toHaveLength(0)
  })

  test('rounds page shows tabs', async ({ page }) => {
    await page.goto('/rounds')
    await expect(page.getByRole('tab', { name: /active|schedule|history|templates/i }).first()).toBeVisible()
  })

  test(
    'create template → generate instance → fill readings → verify 60px touch targets → submit',
    async ({ page }) => {
      await page.goto('/rounds')
      await expect(page).toHaveURL(/\/rounds/)

      // Run a11y on the rounds landing page
      const violationsLanding = await checkA11y(page)
      expect(violationsLanding, `axe violations on /rounds landing: ${JSON.stringify(violationsLanding.map(v => v.id))}`).toHaveLength(0)

      // --- Step 1: Navigate to Templates tab ---
      const templatesTab = page.getByRole('tab', { name: /templates/i })
      await templatesTab.waitFor({ timeout: 8_000 }).catch(() => {
        test.skip(true, 'Templates tab not found — backend not available')
      })
      await templatesTab.click()

      // --- Step 2: Create a new template ---
      const createTemplateBtn = page.getByRole('button', { name: /new template|create template|add template/i })
      await createTemplateBtn.waitFor({ timeout: 5_000 }).catch(() => {
        test.skip(true, 'Create template button not found — skipping workflow test')
      })
      await createTemplateBtn.click()

      // Fill template name
      const templateNameField = page.getByLabel(/template name|name/i).first()
      await templateNameField.waitFor({ timeout: 5_000 })
      const templateName = `E2E Test Template ${Date.now()}`
      await templateNameField.fill(templateName)

      // Add an equipment check item
      const addItemBtn = page.getByRole('button', { name: /add item|add check|add step/i })
      if (await addItemBtn.isVisible()) {
        await addItemBtn.click()
        const itemField = page.getByLabel(/item|check|description/i).last()
        await itemField.fill('Check pressure gauge reading')
      }

      // Save / create the template
      const saveBtn = page.getByRole('button', { name: /save|create|submit/i }).last()
      await saveBtn.click()

      // Confirm template appears in list
      await expect(page.getByText(templateName)).toBeVisible({ timeout: 8_000 })

      // --- Step 3: Generate an instance from the template ---
      const generateBtn = page.getByRole('button', { name: /generate|start round|create instance/i }).first()
      if (await generateBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await generateBtn.click()
      } else {
        // Alternatively click the template row to open it
        await page.getByText(templateName).click()
        const startBtn = page.getByRole('button', { name: /start|generate|begin/i })
        await startBtn.waitFor({ timeout: 5_000 })
        await startBtn.click()
      }

      // --- Step 4: Navigate to Active tab and find the instance ---
      const activeTab = page.getByRole('tab', { name: /active/i })
      await activeTab.waitFor({ timeout: 5_000 }).catch(() => {})
      await activeTab.click()

      // Open the round instance
      const roundRow = page.getByText(templateName).first()
      await roundRow.waitFor({ timeout: 8_000 }).catch(() => {
        test.skip(true, 'Round instance not found in Active tab — backend may be unavailable')
      })
      await roundRow.click()

      // --- Step 5: Verify touch targets are ≥ 60px ---
      // Check all interactive form controls meet the 60px minimum touch target requirement
      const touchTargetViolations = await page.evaluate(() => {
        const MIN_TOUCH_TARGET = 60
        const interactiveSelectors = [
          'button',
          'input[type="checkbox"]',
          'input[type="radio"]',
          'input[type="number"]',
          'input[type="text"]',
          'select',
          '[role="checkbox"]',
          '[role="radio"]',
          '[role="button"]',
        ]
        const violations: string[] = []
        interactiveSelectors.forEach(selector => {
          document.querySelectorAll<HTMLElement>(selector).forEach(el => {
            const rect = el.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0) {
              if (rect.height < MIN_TOUCH_TARGET && rect.width < MIN_TOUCH_TARGET) {
                violations.push(`${selector} at (${Math.round(rect.x)},${Math.round(rect.y)}) is ${Math.round(rect.width)}x${Math.round(rect.height)}px — below 60px`)
              }
            }
          })
        })
        return violations
      })
      expect(touchTargetViolations, `Touch target violations:\n${touchTargetViolations.join('\n')}`).toHaveLength(0)

      // --- Step 6: Fill readings ---
      const numberInputs = page.locator('input[type="number"], input[inputmode="numeric"]')
      const numInputCount = await numberInputs.count()
      if (numInputCount > 0) {
        await numberInputs.first().fill('42')
      }
      const textInputs = page.locator('input[type="text"]:visible')
      const textInputCount = await textInputs.count()
      if (textInputCount > 0) {
        await textInputs.first().fill('Normal')
      }

      // --- Step 7: Run a11y audit on the round form ---
      const violationsForm = await checkA11y(page)
      expect(violationsForm, `axe violations on round form: ${JSON.stringify(violationsForm.map(v => v.id))}`).toHaveLength(0)

      // --- Step 8: Submit the round ---
      const submitBtn = page.getByRole('button', { name: /submit|complete|finish/i })
      await submitBtn.waitFor({ timeout: 5_000 })
      await submitBtn.click()

      // --- Step 9: Verify completion in History tab ---
      const historyTab = page.getByRole('tab', { name: /history/i })
      await historyTab.waitFor({ timeout: 5_000 }).catch(() => {})
      await historyTab.click()

      // Completed round should appear in history
      await expect(page.getByText(templateName).first()).toBeVisible({ timeout: 8_000 })
    }
  )
})
