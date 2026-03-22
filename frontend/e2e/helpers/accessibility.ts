import { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Run an axe-core WCAG 2.1 Level A accessibility audit on the given page.
 * Returns the violations array. Callers should assert violations.length === 0.
 */
export async function checkA11y(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a'])
    .analyze()
  // Return violations so callers can assert and report
  return results.violations
}
