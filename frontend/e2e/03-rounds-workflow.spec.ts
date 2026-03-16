import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test.describe('Rounds workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page)
  })

  test('can navigate to rounds module', async ({ page }) => {
    await page.goto('/rounds')
    await expect(page).toHaveURL(/\/rounds/)
  })

  test('rounds page shows tabs', async ({ page }) => {
    await page.goto('/rounds')
    await expect(page.getByRole('tab', { name: /active|schedule|history|templates/i }).first()).toBeVisible()
  })
})
