import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extractRequirements } from './agents/extraction-agent.js';
import { generateTestIdeas } from './agents/requirement-agent.js';
import { requirementsListSchema } from './schemas/requirements-list.js';
import { testPlanSchema } from './schemas/test-plan.js';

const docPath = process.argv[2];
if (!docPath) {
    console.error('Usage: tsx src/run-pipeline.ts <path-to-requirements-doc>');
    process.exit(1);
}

const document = await readFile(docPath, 'utf-8');

// Stage 1: extract distinct requirements from the raw document
const rawRequirements = await extractRequirements(document);

let requirementsJson: unknown;
try {
    requirementsJson = JSON.parse(rawRequirements);
} catch {
    console.error('Extraction agent did not return valid JSON:\n', rawRequirements);
    process.exit(1);
}

const parsedRequirements = requirementsListSchema.safeParse(requirementsJson);
if (!parsedRequirements.success) {
    console.error('Extracted requirements failed schema validation:');
    console.error(parsedRequirements.error.format());
    process.exit(1);
}

await mkdir('artifacts', { recursive: true });
await writeFile(
    'artifacts/requirements.json',
    JSON.stringify(parsedRequirements.data, null, 2),
    'utf-8'
);
console.log(`Extracted ${parsedRequirements.data.length} requirement(s) -> artifacts/requirements.json`);

// Stage 2: generate a schema-valid test plan for each extracted requirement
await mkdir('artifacts/test-plans', { recursive: true });

for (const requirement of parsedRequirements.data) {
    console.log(`\nGenerating test plan for: ${requirement.feature}`);

    const rawPlan = await generateTestIdeas(requirement.description);

    let planJson: unknown;
    try {
        planJson = JSON.parse(rawPlan);
    } catch {
        console.error(`  Skipped "${requirement.feature}" — model did not return valid JSON`);
        continue;
    }

    const parsedPlan = testPlanSchema.safeParse(planJson);
    if (!parsedPlan.success) {
        console.error(`  Skipped "${requirement.feature}" — failed schema validation`);
        continue;
    }

    const slug = requirement.feature.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await writeFile(
        `artifacts/test-plans/${slug}.json`,
        JSON.stringify(parsedPlan.data, null, 2),
        'utf-8'
    );
    console.log(`  Saved artifacts/test-plans/${slug}.json (${parsedPlan.data.testCases.length} test cases)`);
}
