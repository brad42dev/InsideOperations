import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test.describe('Dashboards', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page)
  })

  test('dashboards list loads', async ({ page }) => {
    await page.goto('/dashboards')
    await expect(page).toHaveURL(/\/dashboards/)
  })
})
