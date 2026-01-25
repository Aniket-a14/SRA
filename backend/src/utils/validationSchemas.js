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
        srsData: z.object({
            details: z.object({
                projectName: z.object({ content: z.string() }).optional(),
                fullDescription: z.object({ content: z.string() }).optional()
            }).optional(),
            metadata: z.record(z.any()).optional()
        }).optional(),
        draft: z.boolean().optional(),
        validationResult: z.object({
            validation_status: z.string(),
            issues: z.array(z.any()).optional(),
            clarification_questions: z.array(z.string()).optional()
        }).optional()
    })
});
