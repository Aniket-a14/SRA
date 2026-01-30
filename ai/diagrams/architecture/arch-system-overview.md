# System Architecture Overview

**Type:** Architecture Diagram
**Last Updated:** 2026-01-30
**Related Files:**
- `backend/src/services/aiService.js`
- `frontend/app/page.tsx`
- `backend/src/controllers/analysisController.js`

## Purpose

Maps the end-to-end flow from raw user input to professional SRS generation, highlighting the AI governance and validation layers.

## Diagram

```mermaid
graph TD
    User(["User Input (Idea)"]) -->|Form Submission| FE[Frontend Dashboard]
    FE -->|API Request| AC[Analysis Controller]
    
    subgraph "SRA Agentic Pipeline (Back-Stage)"
        AC -->|Orchestrate| AIS[AI Service]
        AIS -->|V1.0.0/V1.1.0| PR[Prompt Registry]
        AIS -->|Gemini API| LLM[LLM Engine]
        LLM -->|JSON Schema| VC["Validation & Cleaning (aiService.js)"]
        VC -->|Structured Data| DB[(Supabase/Prisma)]
    end
    
    VC -->|IEEE-830 Result| FE
    FE -->|Interactive View| DFD[DFD Viewer]
    FE -->|Document View| SRS[SRS Document]
    
    %% Impact Annotations
    classDef impact fill:#f9f,stroke:#333,stroke-width:2px;
    Note1["Impact: Industry-standard specs in seconds"]:::impact
    VC -.-> Note1
```

## Key Insights

- **Front-Stage**: Interactive dashboard allowing rapid iteration on project ideas.
- **Back-Stage**: Decoupled prompt registry allowing versioning (V1.0.0, V1.1.0) without service downtime.
- **Impact**: Transformation of informal prose into structured, verifiable technical requirements (IEEE-830).

## Change History

- **2026-01-30:** Initial architectural map created during codebase elevation.
