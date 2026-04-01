import { launchBrowser, login, type Journey } from "./helpers";
import { writeReport } from "./report";
import * as fs from "fs";

// Journeys directory relative to where tsx is invoked (frontend/)
const JOURNEYS_DIR = "tests/integration/journeys";

// Dynamically import all journey files
const journeyFiles = fs
  .readdirSync(JOURNEYS_DIR)
  .filter((f) => f.endsWith(".test.ts"))
  .sort();

async function runAll() {
  const results: Array<{
    journey: string;
    steps: Array<{
      name: string;
      passed: boolean;
      skipped?: boolean;
      error?: string;
    }>;
  }> = [];

  for (const file of journeyFiles) {
    const mod = await import(`./journeys/${file.replace(".ts", "")}`);
    const journey: Journey = mod.default;
    console.log(`\n▶ ${journey.name}`);
    const stepResults: Array<{
      name: string;
      passed: boolean;
      skipped?: boolean;
      error?: string;
    }> = [];

    const browser = await launchBrowser();
    const page = await browser.newPage();

    try {
      const loggedIn = await login(page);
      if (!loggedIn) {
        stepResults.push({
          name: "login",
          passed: false,
          error: "Login failed — check credentials and backend",
        });
      } else {
        for (const step of journey.steps) {
          try {
            await step.run(page);
            await step.verify(page);
            stepResults.push({ name: step.name, passed: true });
            console.log(`  ✅ ${step.name}`);
          } catch (e: any) {
            if (e.message && e.message.startsWith("SKIP:")) {
              stepResults.push({
                name: step.name,
                passed: true,
                skipped: true,
                error: e.message,
              });
              console.log(`  ⏭  ${step.name}: ${e.message}`);
            } else {
              stepResults.push({
                name: step.name,
                passed: false,
                error: e.message,
              });
              console.log(`  ❌ ${step.name}: ${e.message}`);
            }
          }
        }
      }
    } finally {
      if (journey.cleanup) await journey.cleanup(page).catch(() => {});
      await browser.close();
    }

    results.push({ journey: journey.name, steps: stepResults });
  }

  await writeReport(results);

  const allSteps = results.flatMap((r) => r.steps);
  const totalSteps = allSteps.length;
  const skippedSteps = allSteps.filter((s) => s.skipped).length;
  const passedSteps = allSteps.filter((s) => s.passed && !s.skipped).length;
  const failedSteps = allSteps.filter((s) => !s.passed).length;
  const failedJourneys = results.filter((r) =>
    r.steps.some((s) => !s.passed),
  ).length;

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Integration Test Results`);
  console.log(
    `  Journeys: ${results.length} total, ${results.length - failedJourneys} passed, ${failedJourneys} failed`,
  );
  console.log(
    `  Steps:    ${totalSteps} total, ${passedSteps} passed, ${skippedSteps} skipped, ${failedSteps} failed`,
  );
  console.log(`  Report:   docs/uat/integration/REPORT.md`);

  process.exit(failedJourneys > 0 ? 1 : 0);
}

runAll().catch((e) => {
  console.error(e);
  process.exit(1);
});
