import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { generateTestIdeas} from './agents/requirement-agent.js';
import { testPlanSchema } from './schemas/test-plan.js';

const requirement = await readFile(
    'requirements/login.md',
    'utf-8'
);

const raw = await generateTestIdeas(requirement);

let json:unknown;
try {
    json = JSON.parse(raw);
}
catch {
    console.error('Model did not return valid JSON:\n',raw);
    process.exit();
}

const parsed = testPlanSchema.safeParse(json);
if (!parsed.success){
    console.error('Model output failed schema validation:');
    console.error(parsed.error.format());
    process.exit(1);
}

await mkdir('artifacts', { recursive:true });
await writeFile(
    'artifacts/test-plan.json',
    JSON.stringify(parsed.data, null,2 ),
    'utf-8'
);

console.log('Validated test plan saved to artifacts/test-plan.json');
console.log(parsed.data);