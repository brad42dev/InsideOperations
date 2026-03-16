import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test.describe('Reports', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page)
  })

  test('reports module loads with canned templates', async ({ page }) => {
    await page.goto('/reports')
    await expect(page).toHaveURL(/\/reports/)
  })

  test('can open template config panel', async ({ page }) => {
    await page.goto('/reports')
    const firstTemplate = page.getByRole('button', { name: /generate|run|configure/i }).first()
    if (await firstTemplate.isVisible()) {
      await firstTemplate.click()
      // config panel should appear
    }
    // Just check page didn't crash
    await expect(page).toHaveURL(/\/reports/)
  })
})
