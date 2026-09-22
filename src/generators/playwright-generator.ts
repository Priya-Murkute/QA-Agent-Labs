import type { TestCase, TestPlan } from '../schemas/test-plan.js';

// For a JS string literal (single-quoted) — escapes characters that would break out of the quotes.
function escapeForStringLiteral(text: string): string {
    return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ');
}

// For a `//` comment — no quote-escaping needed, but an embedded newline would break the comment
// onto an uncommented line, so newlines are still flattened.
function toComment(text: string): string {
    return text.replace(/\n/g, ' ');
}

function buildTestBlock(tc: TestCase): string {
    const preconditions = tc.preconditions.map((p: string) => `  // Precondition: ${toComment(p)}`).join('\n');
    const steps = tc.steps.map((s: string) => `  // Step: ${toComment(s)}`).join('\n');

    return `
// Priority: ${tc.priority} | Type: ${tc.type}
test.fixme('${tc.id} - ${escapeForStringLiteral(tc.title)}', async ({ page }) => {
${preconditions}
${steps}
  // TODO: implement the Playwright actions for the steps above
  // Expected result: ${toComment(tc.expectedResults)}
  // TODO: implement assertion(s) for the expected result above
});
`;
}

export function buildPlaywrightSpec(testPlan: TestPlan): string {
    const testBlocks = testPlan.testCases.map(buildTestBlock).join('\n');

    return `import { test, expect } from '@playwright/test';

// Auto-generated skeleton for feature: ${testPlan.feature}
// Generated from a schema-validated AI test plan — review before implementing.
// Every test starts as test.fixme() so an unimplemented skeleton reports as
// "not yet working" in Playwright's output instead of silently passing.
${testBlocks}`;
}
