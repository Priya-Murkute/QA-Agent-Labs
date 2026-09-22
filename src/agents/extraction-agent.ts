import { ai, model } from '../ai/client.js';

export async function extractRequirements(document: string) {
    const response = await ai.responses.create({
        model: model,
        max_output_tokens: 5000,
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
                    'Do not invent features that are not supported by the document.\n\n' +
                    'IMPORTANT — only extract items the document states as a CONFIRMED, current requirement. ' +
                    'Do NOT extract something the document itself flags as unresolved, undecided, or not yet ' +
                    'built — this includes text under headings like "Risks," "Open Questions," "Out of Scope," ' +
                    '"Non-goals," "Future," "Planned," or "TBD," and sentences containing phrases such as ' +
                    '"there is no requirement yet," "not decided," "not addressed," "out of scope," ' +
                    '"undefined," "flagged for a future decision," or similar. If a sentence describes the ' +
                    'ABSENCE of a requirement or an unresolved question, do not turn it into a feature.',
            },
            { role: 'user', content: document }
        ]
    });

    return response.output_text;
}
