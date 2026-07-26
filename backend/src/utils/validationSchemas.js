import { z } from 'zod';
import { listAllSectionIds } from '../formats/index.js';

/**
 * The AI settings a client is allowed to choose, and nothing else.
 *
 * `settings` used to be `.passthrough()` (or `z.record(z.any())`), so any key a caller invented
 * travelled all the way into `analyzeText`. Two of those keys steer the *system* prompt —
 * `systemPrompt` replaces it outright and `systemPromptExtension` is interpolated into it — and
 * `apiKey` would let a request nominate the credential the call is billed to. None of the three
 * are the client's to set: the key is resolved server-side from the user's stored provider keys
 * (`asAiSettings`), and the prompts are the platform's.
 *
 * Zod strips unknown keys by default, and `validate()` writes the parsed body back, so leaving
 * `.passthrough()` off is what actually enforces this. Every key here is one both the web app
 * and the CLI already send; `promptVersion` is the documented pin for reproducing an older
 * prompt revision.
 */
export const clientAiSettingsSchema = z.object({
    profile: z.string().optional(),
    depth: z.number().int().min(1).max(5).optional(),
    strictness: z.number().int().min(1).max(5).optional(),
    modelProvider: z.string().optional(),
    modelName: z.string().optional(),
    promptVersion: z.string().max(20).optional(),
    format: z.enum(['ieee830', 'iso29148', 'volere', 'agile-prd']).optional()
});

export const analyzeSchema = z.object({
    body: z.object({
        text: z.string()
            .min(1, "Text input cannot be empty")
            .max(50000, "Text input exceeds 50,000 characters"),
        projectId: z.union([z.string().uuid(), z.literal(""), z.null()]).optional(),
        parentId: z.string().uuid().optional(),
        rootId: z.string().uuid().optional(),
        settings: clientAiSettingsSchema.optional(),
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
// validate, getChatHistory) — still worth validating so a malformed ID
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

// Cross-format document keys: pipeline-derived analysis attached to every result
// regardless of which standard produced it, so they aren't in any format's section list.
const CROSS_FORMAT_RESULT_KEYS = [
    'projectTitle',
    'systemArchitecture',
    'qualityAudit',
    'benchmarks',
    'alignmentResult',
    'layer3Status',
    'diff',
    'missingLogic',
    'contradictions'
];

// updateAnalysis merges `resultUpdates` directly into the stored resultJson — this
// whitelists which top-level SRS keys may be overwritten (unlisted keys are stripped, not
// just rejected, since the schema has no .passthrough()).
//
// The section half is derived from the format registry rather than hand-listed. Hand-listed
// it only ever covered IEEE 830's sections, so an edit to a Volere, ISO 29148 or Agile PRD
// section — from the web editor or from `sra push` — was silently dropped by validation.
const writableResultKeys = Object.fromEntries(
    [...new Set([...CROSS_FORMAT_RESULT_KEYS, ...listAllSectionIds()])].map(key => [key, z.any().optional()])
);

export const updateAnalysisSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid analysis ID") }),
    body: z.object({
        metadata: z.record(z.any()).optional(),
        inPlace: z.boolean().optional(),
        skipAlignment: z.boolean().optional(),
        ...writableResultKeys
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
        settings: clientAiSettingsSchema.optional()
    })
});

export const repairDiagramSchema = z.object({
    body: z.object({
        code: z.string().min(1, "Diagram code is required").max(20000),
        error: z.string().min(1, "Error message is required").max(2000),
        settings: clientAiSettingsSchema.optional(),
        syntaxExplanation: z.string().max(5000).optional()
    })
});

export const generateDFDSchema = z.object({
    body: z.object({
        projectName: z.string().min(1, "Project name is required").max(200),
        description: z.string().min(1, "Description is required").max(10000),
        srsContent: z.any().optional(),
        settings: clientAiSettingsSchema.optional()
    })
});

// POST /validation took `req.body` whole, with no schema at all, and passed it to an LLM.
// The only guard was Express's 10mb JSON limit, so a caller could post megabytes of
// arbitrary structure into a paid generation call. `settings` goes through the same shared
// schema as every other AI route so `systemPrompt`/`apiKey` are stripped here too — this
// route reads `srsData?.settings` directly and would otherwise be the one way around it.
export const validateRequirementsSchema = z.object({
    body: z.object({
        settings: clientAiSettingsSchema.optional(),
        details: z.object({
            projectName: z.object({ content: z.string().max(500).optional() }).passthrough().optional(),
            fullDescription: z.object({ content: z.string().max(50000).optional() }).passthrough().optional()
        }).passthrough().optional()
    }).passthrough()
});

// POST /reuse/suggest embeds `query` and runs a vector search. Unbounded, it was an
// embedding call sized by the caller.
export const reuseSuggestSchema = z.object({
    body: z.object({
        query: z.string().min(1, "Search query is required").max(5000),
        type: z.string().max(100).optional()
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

export const verifyProviderKeySchema = z.object({
    body: z.object({
        provider: z.enum(['GEMINI', 'OPENAI', 'CLAUDE', 'GROK']),
        apiKey: z.string().min(1, "API key is required").max(500)
    })
});
