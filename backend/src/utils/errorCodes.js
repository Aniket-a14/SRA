/**
 * Standardized API Error Codes for SRA Platform.
 * Categorized by domain to provide granular error tracking.
 */
export const ErrorCodes = {
    // Authentication & Authorization (AUTH_*)
    UNAUTHORIZED: "AUTH_001",
    FORBIDDEN: "AUTH_002",
    TOKEN_EXPIRED: "AUTH_003",
    INVALID_CREDENTIALS: "AUTH_004",

    // AI & Analysis (AI_*)
    AI_QUOTA_EXCEEDED: "AI_001",
    AI_GATEKEEPER_FAIL: "AI_002",
    AI_PROCESSING_ERROR: "AI_003",
    AI_VALIDATION_ERROR: "AI_004",

    // Project & Data (DATA_*)
    PROJECT_NOT_FOUND: "DATA_001",
    ANALYSIS_NOT_FOUND: "DATA_002",
    VALIDATION_FAILED: "DATA_003",
    DATABASE_ERROR: "DATA_004",

    // System (SYS_*)
    INTERNAL_ERROR: "SYS_001",
    RATE_LIMIT_EXCEEDED: "SYS_002",
    GATEWAY_TIMEOUT: "SYS_003",
    SERVICE_UNAVAILABLE: "SYS_004"
};
