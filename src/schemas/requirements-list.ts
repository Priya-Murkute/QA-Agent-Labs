import { z } from 'zod';

export const requirementSchema = z.object({
    feature: z.string(),
    description: z.string(),
});

export const requirementsListSchema = z.array(requirementSchema);

export type Requirement = z.infer<typeof requirementSchema>;
