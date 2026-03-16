import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test.describe('Forensics', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page)
  })

  test('forensics module loads', async ({ page }) => {
    await page.goto('/forensics')
    await expect(page).toHaveURL(/\/forensics/)
  })
})
