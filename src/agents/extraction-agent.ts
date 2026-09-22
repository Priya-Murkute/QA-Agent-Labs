import { ai, model } from '../ai/client.js';

export async function extractRequirements(document: string) {
    const response = await ai.responses.create({
        model: model,
        input: [
            {
                role: 'system',
                content:
                    'You are a business analyst preparing a document for QA test design. ' +
                    'Read the following document (it may be a user story, case study, spec, or informal notes) ' +
                    'and identify every distinct testable feature or requirement it describes. ' +
                    'Return ONLY valid JSON (no markdown fences, no commentary) matching exactly this shape:\n' +
                    '[\n' +
                    '  { "feature": string, "description": string }\n' +
                    ']\n' +
                    'Each "description" must be self-contained, as if handed to a QA engineer on its own. ' +
                    'If the document only describes one feature, return an array with a single item. ' +
                    'Do not invent features that are not supported by the document.',
            },
            { role: 'user', content: document }
        ]
    });

    return response.output_text;
}
