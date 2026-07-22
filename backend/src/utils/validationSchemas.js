import { z } from 'zod';

export const analyzeSchema = z.object({
    body: z.object({
        text: z.string()
            .min(1, "Text input cannot be empty")
            .max(50000, "Text input exceeds 50,000 characters"),
        projectId: z.union([z.string().uuid(), z.literal(""), z.null()]).optional(),
        parentId: z.string().uuid().optional(),
        rootId: z.string().uuid().optional(),
        settings: z.object({
            profile: z.string().optional(),
            depth: z.number().int().min(1).max(5).optional(),
            strictness: z.number().int().min(1).max(5).optional(),
            modelProvider: z.string().optional(),
            modelName: z.string().optional()
        }).passthrough().optional(),
        srsData: z.object({
            details: z.object({
                projectName: z.object({ content: z.string().optional() }).optional(),
                fullDescription: z.object({ content: z.string().optional() }).optional()
            }).passthrough().optional(),
            metadata: z.record(z.any()).optional()
        }).passthrough().optional(),
        draft: z.boolean().optional(),
        validationResult: z.object({
            validation_status: z.string(),
            issues: z.array(z.any()).optional(),
            clarification_questions: z.array(z.string()).optional()
        }).passthrough().optional()
    })
});

export const signupSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email format"),
        password: z.string().min(6, "Password must be at least 6 characters"),
        name: z.string().min(2, "Name must be at least 2 characters").optional()
    })
});

export const loginSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email format"),
        password: z.string().min(1, "Password is required")
    })
});

export const projectCreateSchema = z.object({
    body: z.object({
        name: z.string().min(1, "Project name is required").max(100),
        description: z.string().optional()
    })
});

export const projectUpdateSchema = z.object({
    body: z.object({
        name: z.string().min(1, "Project name is required").max(100).optional(),
        description: z.string().optional(),
        settings: z.record(z.any()).optional()
    })
});

// --- Analysis routes (BE-06: these previously took raw req.body with no schema) ---

// Generic `:id` param check for routes that don't take a meaningful body (finalize,
// validate, generateCode, getChatHistory) — still worth validating so a malformed ID
// gets a clean 400 instead of falling through to a Prisma cast error.
export const idParamSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid analysis ID") })
});

export const getAnalysisSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid analysis ID") }),
    query: z.object({ mode: z.string().optional() }).passthrough().optional()
});

export const rootIdParamSchema = z.object({
    params: z.object({ rootId: z.string().uuid("Invalid root ID") })
});

// DELETE /api/analysis/:id — `chain=true` deletes the entire rootId lineage in one
// shot; omitted/false restricts deletion to a childless leaf version (see BE-19/Phase 5
// reconciliation — avoids orphaning parentId pointers on a partial delete).
export const deleteAnalysisSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid analysis ID") }),
    query: z.object({ chain: z.enum(['true', 'false']).optional() }).optional()
});

export const diffParamSchema = z.object({
    params: z.object({
        id1: z.string().uuid("Invalid analysis ID"),
        id2: z.string().uuid("Invalid analysis ID")
    })
});

// updateAnalysis merges `resultUpdates` directly into the stored resultJson —
// this explicitly whitelists which top-level SRS keys may be overwritten (unlisted
// keys are stripped, not just rejected, since the schema has no .passthrough()).
export const updateAnalysisSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid analysis ID") }),
    body: z.object({
        metadata: z.record(z.any()).optional(),
        inPlace: z.boolean().optional(),
        skipAlignment: z.boolean().optional(),
        projectTitle: z.string().optional(),
        introduction: z.any().optional(),
        overallDescription: z.any().optional(),
        externalInterfaceRequirements: z.any().optional(),
        systemFeatures: z.any().optional(),
        nonFunctionalRequirements: z.any().optional(),
        otherRequirements: z.any().optional(),
        glossary: z.any().optional(),
        appendices: z.any().optional(),
        userStories: z.any().optional(),
        features: z.any().optional(),
        systemArchitecture: z.any().optional(),
        revisionHistory: z.any().optional(),
        qualityAudit: z.any().optional(),
        benchmarks: z.any().optional(),
        alignmentResult: z.any().optional(),
        layer3Status: z.any().optional(),
        diff: z.any().optional(),
        missingLogic: z.any().optional(),
        contradictions: z.any().optional()
    })
});

export const chatSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid analysis ID") }),
    body: z.object({
        message: z.string().min(1, "Message cannot be empty").max(10000, "Message is too long"),
        clientMessageId: z.string().uuid("Invalid client message ID").optional()
    })
});

export const regenerateSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid analysis ID") }),
    body: z.object({
        improvementNotes: z.string().min(1, "Improvement notes are required").max(5000),
        affectedSections: z.array(z.string()).optional()
    })
});

export const autoFixSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid analysis ID") }),
    body: z.object({
        issueId: z.string().min(1, "Issue ID is required")
    })
});

export const expandFeatureSchema = z.object({
    body: z.object({
        name: z.string().min(1, "Feature name is required").max(200),
        prompt: z.string().min(1, "Prompt is required").max(5000),
        settings: z.object({
            modelProvider: z.string().optional(),
            modelName: z.string().optional()
        }).passthrough().optional()
    })
});

export const repairDiagramSchema = z.object({
    body: z.object({
        code: z.string().min(1, "Diagram code is required").max(20000),
        error: z.string().min(1, "Error message is required").max(2000),
        settings: z.record(z.any()).optional(),
        syntaxExplanation: z.string().max(5000).optional()
    })
});

export const generateDFDSchema = z.object({
    body: z.object({
        projectName: z.string().min(1, "Project name is required").max(200),
        description: z.string().min(1, "Description is required").max(10000),
        srsContent: z.any().optional(),
        settings: z.record(z.any()).optional()
    })
});

export const providerKeyBodySchema = z.object({
    body: z.object({
        provider: z.enum(['GEMINI', 'OPENAI', 'CLAUDE', 'GROK']),
        apiKey: z.string().min(1, "API key is required").max(500),
        label: z.string().max(100).optional()
    })
});

export const providerParamSchema = z.object({
    params: z.object({
        provider: z.enum(['GEMINI', 'OPENAI', 'CLAUDE', 'GROK'])
    })
});
