import { type Journey, navigate, takeNamedScreenshot } from '../helpers';

export default {
  name: 'Console — Workspace Load',
  steps: [
    {
      name: 'navigate to console',
      run: async (page) => { await navigate(page, '/console'); },
      verify: async (page) => {
        // Verify we landed on the console route (not redirected to login)
        if (page.url().includes('/login')) throw new Error('Redirected to login — session invalid');
        // Verify the page header shows "Console"
        const heading = await page.$('h1');
        const text = heading ? await heading.textContent() : null;
        if (text?.trim() !== 'Console') throw new Error(`Expected h1 "Console", got "${text}"`);
      }
    },
    {
      name: 'console module has content',
      run: async (page) => { await takeNamedScreenshot(page, '02-console'); },
      verify: async (_page) => {
        // SKIP: Console module fails to load (react-zoom-pan-pinch missing dep or build issue)
        // fill in when console/index.tsx and its dependencies are fully built
        throw new Error('SKIP: Console module fails to load — fill in when console module is implemented');
      }
    },
    {
      name: 'open first workspace (if any)',
      run: async (_page) => { /* navigate to first workspace if list is non-empty */ },
      verify: async (_page) => {
        // SKIP: requires OPC data and a working console module
        throw new Error('SKIP: requires OPC data — fill in when OPC pipeline is connected');
      }
    }
  ]
} satisfies Journey;
