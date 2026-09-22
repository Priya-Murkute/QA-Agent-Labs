import { ai, model } from '../ai/client.js';

export async function generateTestIdeas(requirement: string) {
    const response = await ai.responses.create({
        model: model,
        input: [
            {
                role: 'system',
                content:
                    'You are a senior QA engineer. Analyze the requirement and return ONLY valid JSON (no markdown fences, no commentary) matching exactly this shape:\n' +
                    '{\n' +
                    '  "feature": string,\n' +
                    '  "assumptions": string[],\n' +
                    '  "testCases": [\n' +
                    '    {\n' +
                    '      "id": string,\n' +
                    '      "title": string,\n' +
                    '      "type": "positive" | "negative" | "boundary",\n' +
                    '      "priority": "P0" | "P1" | "P2",\n' +
                    '      "preconditions": string[],\n' +
                    '      "steps": string[],\n' +
                    '      "expectedResults": string\n' +
                    '    }\n' +
                    '  ]\n' +
                    '}\n' +
                    'Include a mix of positive, negative and boundary cases.\n\n' +
                    'IMPORTANT — do not invent specific technical constraints that are not stated or clearly ' +
                    'implied by the requirement below (exact numeric limits, URL/field length limits, protocol ' +
                    'or infrastructure behavior such as SSL/hosting/migration, rate limits, etc.). If the ' +
                    'requirement does not specify a concrete number or mechanism for something, write the test ' +
                    'case around the behavior that IS stated, or phrase it generically (e.g. "an unusually long ' +
                    'value" rather than a specific invented character count). Every entry in "assumptions" must ' +
                    'be something a reasonable QA engineer would infer from the requirement text itself — not a ' +
                    'fabricated system limit.',
            },
            {
                role: 'user',
                content: requirement
            }
        ]
    });

    return response.output_text;
}