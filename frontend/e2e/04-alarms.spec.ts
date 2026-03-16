import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test.describe('Alarms', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page)
  })

  test('settings alarm definitions page loads', async ({ page }) => {
    await page.goto('/settings/alarm-definitions')
    await expect(page).toHaveURL(/settings/)
  })
})
