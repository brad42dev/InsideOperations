import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test.describe('Emergency Alert', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page)
  })

  test('alerts module loads', async ({ page }) => {
    await page.goto('/alerts')
    await expect(page).toHaveURL(/\/alerts/)
  })
})
