import { z } from 'zod';

export const testCaseSchema = z.object({
    id: z.string(),
    title: z.string(),
    type: z.enum(['positive', 'negative', 'boundary']),
    priority: z.enum(['P0', 'P1', 'P2' ]),
    preconditions: z.array(z.string()),
    steps: z.array(z.string()),
    expectedResults: z.string(),
});

export const testPlanSchema = z.object({
    feature: z.string(),
    assumptions: z.array(z.string()),
    testCases: z.array(testCaseSchema),
});

export type TestPlan = z.infer<typeof testPlanSchema>;