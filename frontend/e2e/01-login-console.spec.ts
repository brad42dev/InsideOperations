import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test.describe('Login → Console → Live Data', () => {
  test('can log in and navigate to console', async ({ page }) => {
    await loginAs(page)
    await page.getByRole('link', { name: /console/i }).click()
    await expect(page).toHaveURL(/\/console/)
    await expect(page.getByText(/console/i)).toBeVisible()
  })

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/username/i).fill('admin')
    await page.getByLabel(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible()
  })

  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/console')
    await expect(page).toHaveURL(/\/login/)
  })
})
