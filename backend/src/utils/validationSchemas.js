import { z } from 'zod';

export const analyzeSchema = z.object({
    body: z.object({
        text: z.string()
            .min(1, "Text input cannot be empty")
            .max(50000, "Text input exceeds 50,000 characters"),
        projectId: z.string().uuid().optional(),
        settings: z.object({
            profile: z.string().optional(),
            depth: z.number().int().min(1).max(5).optional(),
            strictness: z.number().int().min(1).max(5).optional(),
            modelProvider: z.string().optional(),
            modelName: z.string().optional()
        }).optional(),
        srsData: z.record(z.any()).optional(), // Loose validation for now
        draft: z.boolean().optional(),
        validationResult: z.any().optional()
    })
});
