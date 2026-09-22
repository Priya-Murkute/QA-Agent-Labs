import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extractRequirements } from './agents/extraction-agent.js';
import { generateTestIdeas } from './agents/requirement-agent.js';
import { requirementsListSchema, type Requirement } from './schemas/requirements-list.js';
import { testPlanSchema } from './schemas/test-plan.js';
import { chunkDocument } from './utils/chunk.js';
import { withRetry } from './utils/retry.js';
import { mapWithConcurrency } from './utils/concurrency.js';

const MAX_INPUT_TOKENS_PER_CHUNK = 2500; // leaves headroom under Groq's 8000 total-token cap
const EXTRACTION_CONCURRENCY = 2;
const TEST_PLAN_CONCURRENCY = 4;

const docPath = process.argv[2];
if (!docPath) {
    console.error('Usage: tsx src/run-pipeline.ts <path-to-requirements-doc>');
    process.exit(1);
}

const document = await readFile(docPath, 'utf-8');
const chunks = chunkDocument(document, MAX_INPUT_TOKENS_PER_CHUNK);
console.log(`Document split into ${chunks.length} chunk(s) for extraction`);

// Stage 1: extract requirements from each chunk (in parallel, bounded), then merge + de-duplicate
const perChunkResults = await mapWithConcurrency(chunks, EXTRACTION_CONCURRENCY, async (chunk, index) => {
    console.log(`Extracting from chunk ${index + 1}/${chunks.length}...`);

    const rawRequirements = await withRetry(() => extractRequirements(chunk));

    let requirementsJson: unknown;
    try {
        requirementsJson = JSON.parse(rawRequirements);
    } catch {
        console.error(`  Chunk ${index + 1}: invalid JSON, skipping`);
        return [] as Requirement[];
    }

    const parsedRequirements = requirementsListSchema.safeParse(requirementsJson);
    if (!parsedRequirements.success) {
        console.error(`  Chunk ${index + 1}: failed schema validation, skipping`);
        return [] as Requirement[];
    }

    console.log(`  Chunk ${index + 1}: extracted ${parsedRequirements.data.length} requirement(s)`);
    return parsedRequirements.data;
});

const allRequirements = perChunkResults.flat();

const seen = new Set<string>();
const dedupedRequirements = allRequirements.filter(requirement => {
    const key = requirement.feature.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
});

await mkdir('artifacts', { recursive: true });
await writeFile(
    'artifacts/requirements.json',
    JSON.stringify(dedupedRequirements, null, 2),
    'utf-8'
);
console.log(`\nExtracted ${dedupedRequirements.length} unique requirement(s) -> artifacts/requirements.json`);

// Stage 2: generate a schema-valid test plan for each extracted requirement (in parallel, bounded)
await mkdir('artifacts/test-plans', { recursive: true });

await mapWithConcurrency(dedupedRequirements, TEST_PLAN_CONCURRENCY, async requirement => {
    console.log(`Generating test plan for: ${requirement.feature}`);

    const rawPlan = await withRetry(() => generateTestIdeas(requirement.description));

    let planJson: unknown;
    try {
        planJson = JSON.parse(rawPlan);
    } catch {
        console.error(`  Skipped "${requirement.feature}" — model did not return valid JSON`);
        return;
    }

    const parsedPlan = testPlanSchema.safeParse(planJson);
    if (!parsedPlan.success) {
        console.error(`  Skipped "${requirement.feature}" — failed schema validation`);
        return;
    }

    const slug = requirement.feature.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await writeFile(
        `artifacts/test-plans/${slug}.json`,
        JSON.stringify(parsedPlan.data, null, 2),
        'utf-8'
    );
    console.log(`  Saved artifacts/test-plans/${slug}.json (${parsedPlan.data.testCases.length} test cases)`);
});
