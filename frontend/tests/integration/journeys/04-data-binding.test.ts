import { type Journey, navigate, takeNamedScreenshot } from '../helpers';

export default {
  name: 'Data Binding — OPC Point Browser',
  steps: [
    {
      name: 'navigate to console or designer with point binding',
      run: async (page) => { await navigate(page, '/console'); },
      verify: async (page) => {
        if (page.url().includes('/login')) throw new Error('Redirected to login — session invalid');
        // Verify the page header shows "Console"
        const heading = await page.$('h1');
        const text = heading ? await heading.textContent() : null;
        if (text?.trim() !== 'Console') throw new Error(`Expected h1 "Console", got "${text}"`);
      }
    },
    {
      name: 'point browser accessible',
      run: async (page) => { await takeNamedScreenshot(page, '04-data-binding'); },
      verify: async (_page) => {
        // SKIP: requires OPC service running and working console/designer module
        throw new Error('SKIP: requires OPC service — fill in when OPC pipeline is connected');
      }
    },
    {
      name: 'real-time value updates',
      run: async (_page) => { /* wait for value updates from live OPC data */ },
      verify: async (_page) => {
        // SKIP: requires live OPC data from SimBLAH simulator
        throw new Error('SKIP: requires live OPC data — fill in when SimBLAH is connected');
      }
    }
  ]
} satisfies Journey;
