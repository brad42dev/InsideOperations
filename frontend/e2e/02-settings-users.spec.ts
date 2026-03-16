import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test.describe('Settings — User management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page)
    await page.goto('/settings/users')
  })

  test('shows user list', async ({ page }) => {
    await expect(page.getByRole('table')).toBeVisible()
    // Admin user should exist
    await expect(page.getByText('admin')).toBeVisible()
  })

  test('can open create user dialog', async ({ page }) => {
    await page.getByRole('button', { name: /add user|new user|create/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByLabel(/username/i)).toBeVisible()
  })
})
