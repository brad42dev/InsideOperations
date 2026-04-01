import { chromium, Browser, Page } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const _thisDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(_thisDir, "../../..");

export const BASE_URL = "http://localhost:5173";
export const API_URL = "http://localhost:3000";

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

export async function login(
  page: Page,
  username = "admin",
  password = "admin",
): Promise<boolean> {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[name="username"], input[type="text"]', {
    timeout: 10000,
  });
  await page.fill('input[name="username"], input[type="text"]', username);
  await page.fill('input[name="password"], input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for redirect away from /login
  try {
    await page.waitForURL((url) => !url.toString().includes("/login"), {
      timeout: 10000,
    });
    return true;
  } catch {
    // Try alternate credentials
    if (username === "admin" && password === "admin") {
      return login(page, "admin", "changeme");
    }
    return false;
  }
}

export async function navigate(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForLoadState("networkidle", { timeout: 15000 });
}

export async function takeNamedScreenshot(
  page: Page,
  name: string,
): Promise<void> {
  const dir = path.resolve(REPO_ROOT, "docs/uat/integration/screenshots");
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
}

export interface Step {
  name: string;
  run: (page: Page) => Promise<void>;
  verify: (page: Page) => Promise<void>;
}

export interface Journey {
  name: string;
  steps: Step[];
  cleanup?: (page: Page) => Promise<void>;
}
