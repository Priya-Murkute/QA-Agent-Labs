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
                    'Include a mix of positive, negative and boundary cases.',
            },
            {
                role: 'user',
                content: requirement
            }
        ]
    });

    return response.output_text;
}