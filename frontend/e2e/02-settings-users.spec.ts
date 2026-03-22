import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'
import { checkA11y } from './helpers/accessibility'

test.describe('Settings — User management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page)
    await page.goto('/settings/users')
  })

  test('settings users page is accessible', async ({ page }) => {
    const violations = await checkA11y(page)
    expect(violations, `axe violations on /settings/users: ${JSON.stringify(violations.map(v => v.id))}`).toHaveLength(0)
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
    // Run a11y on the open dialog
    const violations = await checkA11y(page)
    expect(violations, `axe violations on create user dialog: ${JSON.stringify(violations.map(v => v.id))}`).toHaveLength(0)
  })
})
