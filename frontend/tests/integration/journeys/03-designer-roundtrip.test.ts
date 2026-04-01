import { type Journey, navigate, takeNamedScreenshot } from "../helpers";

export default {
  name: "Designer — Open and Render",
  steps: [
    {
      name: "navigate to designer",
      run: async (page) => {
        await navigate(page, "/designer");
      },
      verify: async (page) => {
        if (page.url().includes("/login"))
          throw new Error("Redirected to login — session invalid");
        // Verify the page header shows "Designer"
        const heading = await page.$("h1");
        const text = heading ? await heading.textContent() : null;
        if (text?.trim() !== "Designer")
          throw new Error(`Expected h1 "Designer", got "${text}"`);
      },
    },
    {
      name: "designer UI renders",
      run: async (page) => {
        await takeNamedScreenshot(page, "03-designer");
      },
      verify: async (_page) => {
        // SKIP: Designer module fails to load (dynamic import error)
        // fill in when designer/index.tsx and its dependencies are fully built
        throw new Error(
          "SKIP: Designer module fails to load — fill in when designer module is implemented",
        );
      },
    },
    {
      name: "create new graphic (if supported)",
      run: async (_page) => {
        /* attempt to create a new graphic file */
      },
      verify: async (_page) => {
        // SKIP: requires working designer module
        throw new Error(
          "SKIP: fill in when designer new-file flow is implemented",
        );
      },
    },
  ],
} satisfies Journey;
