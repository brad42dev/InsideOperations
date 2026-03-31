import { Page } from "@playwright/test";

const TEST_USER = {
  username: process.env.E2E_USERNAME ?? "admin",
  password: process.env.E2E_PASSWORD ?? "admin",
};

export async function loginAs(
  page: Page,
  username = TEST_USER.username,
  password = TEST_USER.password,
) {
  await page.goto("/login");
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(console|dashboard|settings|process)/);
}

export async function logout(page: Page) {
  await page.goto("/");
  // Click the user menu and logout
  await page.getByRole("button", { name: /logout|sign out/i }).click();
  await page.waitForURL("/login");
}
