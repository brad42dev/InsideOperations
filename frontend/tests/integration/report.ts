import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const _thisDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(_thisDir, '../../..');

export async function writeReport(results: Array<{journey: string, steps: Array<{name: string, passed: boolean, skipped?: boolean, error?: string}>}>) {
  const dir = path.resolve(REPO_ROOT, 'docs/uat/integration');
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(`${dir}/screenshots`, { recursive: true });

  const timestamp = new Date().toISOString();
  const allSteps = results.flatMap(r => r.steps);
  const totalSteps = allSteps.length;
  const skippedSteps = allSteps.filter(s => s.skipped).length;
  const passedSteps = allSteps.filter(s => s.passed && !s.skipped).length;
  const failedSteps = allSteps.filter(s => !s.passed).length;
  const passedJourneys = results.filter(r => r.steps.every(s => s.passed)).length;

  let md = `# Integration Test Report\nGenerated: ${timestamp}\n\n`;
  md += `## Summary\n`;
  md += `- Journeys: ${results.length} total, ${passedJourneys} passed, ${results.length - passedJourneys} failed\n`;
  md += `- Steps: ${totalSteps} total, ${passedSteps} passed, ${skippedSteps} skipped, ${failedSteps} failed\n\n`;
  md += `## Results\n`;

  for (const r of results) {
    const icon = r.steps.every(s => s.passed) ? '✅' : '❌';
    md += `\n### ${icon} ${r.journey}\n`;
    for (const s of r.steps) {
      const stepIcon = s.skipped ? '⏭' : s.passed ? '✅' : '❌';
      md += `  ${stepIcon} ${s.name}${s.error ? ` — ${s.error}` : ''}\n`;
    }
  }

  fs.writeFileSync(path.join(dir, 'REPORT.md'), md);

  // Also write JSON for programmatic use
  fs.writeFileSync(path.join(dir, 'REPORT.json'), JSON.stringify({ timestamp, results }, null, 2));
}
