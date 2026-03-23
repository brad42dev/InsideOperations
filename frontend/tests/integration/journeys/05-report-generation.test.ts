import { type Journey, navigate, takeNamedScreenshot } from '../helpers';

export default {
  name: 'Reports — Generate a Canned Report',
  steps: [
    {
      name: 'navigate to reports',
      run: async (page) => { await navigate(page, '/reports'); },
      verify: async (page) => {
        if (page.url().includes('/login')) throw new Error('Redirected to login — session invalid');
        // Verify the page header shows "Reports"
        const heading = await page.$('h1');
        const text = heading ? await heading.textContent() : null;
        if (text?.trim() !== 'Reports') throw new Error(`Expected h1 "Reports", got "${text}"`);
      }
    },
    {
      name: 'report list renders',
      run: async (page) => { await takeNamedScreenshot(page, '05-reports'); },
      verify: async (_page) => {
        // SKIP: Reports module fails to load (dynamic import error)
        // fill in when reports/index.tsx and its dependencies are fully built
        throw new Error('SKIP: Reports module fails to load — fill in when reports module is implemented');
      }
    },
    {
      name: 'generate a report',
      run: async (_page) => { /* select first available report and trigger generation */ },
      verify: async (_page) => {
        // SKIP: requires working reports module and async generation pipeline
        throw new Error('SKIP: fill in when async report generation pipeline is implemented');
      }
    }
  ]
} satisfies Journey;
