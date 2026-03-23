import { type Journey, navigate, takeNamedScreenshot } from '../helpers';

export default {
  name: 'Login and Session',
  steps: [
    {
      name: 'successful login lands on app',
      // Runner has already logged in — wait for full page load then verify
      run: async (page) => { await page.waitForLoadState('networkidle', { timeout: 15000 }); },
      verify: async (page) => {
        if (page.url().includes('/login')) throw new Error('Still on login page after auth');
        const heading = await page.$('h1');
        if (!heading) throw new Error('No h1 heading found — not on app page');
      }
    },
    {
      name: 'app shell renders',
      run: async (page) => { await takeNamedScreenshot(page, '01-app-shell'); },
      verify: async (page) => {
        // Sidebar nav exists with multiple module links
        const nav = await page.$('nav[aria-label="Main navigation"]');
        if (!nav) throw new Error('Main navigation sidebar not found');
        const links = await page.$$('nav[aria-label="Main navigation"] a');
        if (links.length < 3) throw new Error(`Expected at least 3 nav links, found ${links.length}`);
        // User info visible in header
        const userBtn = await page.$('button:has-text("admin")');
        if (!userBtn) throw new Error('User button with "admin" not visible in header');
      }
    },
    {
      name: 'sidebar navigation works',
      run: async (page) => { await navigate(page, '/reports'); },
      verify: async (page) => {
        if (page.url().includes('/login')) throw new Error('Navigation redirected to login — session lost');
        const heading = await page.$('h1');
        const text = heading ? await heading.textContent() : null;
        if (text?.trim() !== 'Reports') throw new Error(`Expected h1 "Reports" after navigation, got "${text}"`);
      }
    }
  ]
} satisfies Journey;
