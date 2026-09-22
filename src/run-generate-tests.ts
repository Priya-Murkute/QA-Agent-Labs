import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { testPlanSchema } from './schemas/test-plan.js';
import { buildPlaywrightSpec } from './generators/playwright-generator.js';

const OUTPUT_DIR = 'tests/generated';
const inputPath = process.argv[2] ?? 'artifacts/test-plan.json';

async function collectTestPlanFiles(target: string): Promise<string[]> {
    const info = await stat(target);
    if (info.isDirectory()) {
        const entries = await readdir(target);
        return entries.filter(f => f.endsWith('.json')).map(f => path.join(target, f));
    }
    return [target];
}

const files = await collectTestPlanFiles(inputPath);
if (files.length === 0) {
    console.error(`No test-plan JSON files found at ${inputPath}`);
    process.exit(1);
}

await mkdir(OUTPUT_DIR, { recursive: true });

let generated = 0;
for (const file of files) {
    const raw = await readFile(file, 'utf-8');

    let json: unknown;
    try {
        json = JSON.parse(raw);
    } catch {
        console.error(`Skipping ${file} — not valid JSON`);
        continue;
    }

    const parsed = testPlanSchema.safeParse(json);
    if (!parsed.success) {
        console.error(`Skipping ${file} — does not match testPlanSchema`);
        continue;
    }

    const spec = buildPlaywrightSpec(parsed.data);
    const outFile = path.join(OUTPUT_DIR, `${path.basename(file, '.json')}.spec.ts`);
    await writeFile(outFile, spec, 'utf-8');
    console.log(`Generated ${outFile} (${parsed.data.testCases.length} test cases)`);
    generated++;
}

console.log(`\nDone: ${generated}/${files.length} spec file(s) generated in ${OUTPUT_DIR}/`);
