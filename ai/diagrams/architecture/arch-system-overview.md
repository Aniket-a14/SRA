# System Architecture Overview

**Type:** Architecture Diagram
**Last Updated:** 2026-02-16
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
    
    subgraph "SRA Multi-Agent Pipeline (Back-Stage)"
        AC -->|Orchestrate| MAS[MAS Orchestrator]
        MAS --> PO["Product Owner Agent (Scope)"]
        MAS --> Arch["Architect Agent (Tech Stack + RAG)"]
        MAS --> Dev["Lead Developer Agent (IEEE-830)"]
        
        subgraph "Objective Quality Loop"
            Dev --> Critic["Critic Agent (6Cs Audit)"]
            Dev --> Eval["Evaluation Service (RAGAS)"]
        end
        
        Critic -->|Scores/Issues| MAS
        Eval -->|Faithfulness| MAS
    end
    
    MAS -->|Verified SRS JSON| FE
    FE -->|Interactive View| DFD[DFD Viewer]
    FE -->|Document View| SRS[SRS Document]
    FE -->|Benchmark View| BV[Quality Benchmarks]
```

## Key Insights

- **Front-Stage**: Interactive dashboard allowing rapid iteration on project ideas.
- **Back-Stage**: Decoupled prompt registry allowing versioning (V1.0.0, V1.1.0) without service downtime.
- **Impact**: Transformation of informal prose into structured, verifiable technical requirements (IEEE-830).

## Change History

- **2026-01-30:** Initial architectural map created during codebase elevation.
- **2026-02-16:** Upgraded to Multi-Agent System (MAS) architecture with objective quality and RAG evaluation layers.
