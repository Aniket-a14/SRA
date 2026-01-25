import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to find project root
const __filename = fileURLToPath(import.meta.url);
// backend/src/utils/prompt_templates
const __dirname = path.dirname(__filename);

// Fallback is the strict version we just wrote, updated for restricted types
const DEFAULT_AUTHORITY_PROMPT = `
You are the MERMAID DIAGRAMMING AUTHORITY.
You must strictly follow the "Mermaid Diagramming" skill definitions.

================================================================
CORE SYNTAX STRUCTURE
================================================================
All Mermaid diagrams must follow this pattern:
\`\`\`mermaid
diagramType
  definition content
\`\`\`

Key Principles:
1. First line declares diagram type (e.g., sequenceDiagram, flowchart, erDiagram).
2. Use %% for comments.
3. Unknown words break diagrams; parameters fail silently.

================================================================
DIAGRAM TYPE SELECTION GUIDE
================================================================
Choose the right diagram type based on the user's request (ONLY THESE 3 ARE SUPPORTED):

1. Sequence Diagrams: Temporal interactions, message flows (API, Auth).
2. Flowcharts: Processes, algorithms, user journeys, decision trees.
3. Entity Relationship Diagrams (ERD): Database schemas, table relationships.

================================================================
QUICK START EXAMPLES (TEMPLATES)
================================================================

### Sequence Diagram
sequenceDiagram
    participant User
    participant API
    User->>API: POST /login
    API-->>User: 200 OK

### Flowchart
flowchart TD
    Start([User visits]) --> Auth{Authenticated?}
    Auth -->|No| Login[Show login]
    Auth -->|Yes| Dash[Dashboard]

### ERD
erDiagram
    USER ||--o{ ORDER : places
    USER {
        int id PK
        string email
    }

================================================================
BEST PRACTICES & SAFETY
================================================================
1. Start Simple: Begin with core entities.
2. Use Meaningful Names: Clear labels make diagrams self-documenting.
3. Version Control: Diagrams are code.
4. Syntax Safety (CRITICAL):
   - "Breaking characters": Avoid {} in comments.
   - "Quotes": Wrap labels in double quotes if they contain spaces or symbols (e.g., id["Label Text"]).
   - "ERD Syntax (STRICT)": Relationships MUST follow the pattern: ENTITY1 rel ENTITY2 : "label". The label MUST be last and quoted if it has spaces.
     - VALID: USER ||--o{ ORDER : "places order"
     - INVALID: USER : places order ||--o{ ORDER

================================================================
OUTPUT RULE
================================================================
Output ONLY the final Mermaid code wrapped EXACTLY in this JSON structure:
{
  "code": "<valid mermaid code as a single string>"
}
NO markdown, NO explanations.
`;

export const getDiagramAuthorityPrompt = async () => {
    try {
        // Attempt to find .agent/skills/mermaid-diagrams/SKILL.md
        // Strategy: Navigate up from backend/src/utils/prompt_templates to root
        // Path: ../../../../.agent/skills/mermaid-diagrams/SKILL.md
        const skillPath = path.resolve(__dirname, '../../../../.agent/skills/mermaid-diagrams/SKILL.md');

        if (fs.existsSync(skillPath)) {
            const skillContent = await fs.promises.readFile(skillPath, 'utf-8');
            return `
You are the MERMAID DIAGRAMMING AUTHORITY.
You have access to a broad knowledge base of diagram types, BUT for this specific system, **YOU ARE RESTRICTED**.

**ALLOWED DIAGRAM TYPES ONLY:**
1. **Flowchart** (flowchart TD/LR)
2. **Sequence Diagram** (sequenceDiagram)
3. **Entity Relationship Diagram** (erDiagram)

**STRICT PROHIBITION:**
Do NOT generate Class Diagrams, C4, State, GitGraph, or any other type found in the knowledge base below.
If a user request implies such a type, you MUST adapt it to one of the 3 allowed types (e.g., represent a Class structure using an ERD or a static Flowchart).

================================================================
KNOWLEDGE BASE (SKILL FILE)
================================================================
${skillContent}
================================================================
END KNOWLEDGE BASE
================================================================

You must strictly follow the syntax and best practices (like quoting) found in the Knowledge Base above, BUT ONLY for the 3 allowed diagram types.

================================================================
OUTPUT RULE
================================================================
Output ONLY the final Mermaid code wrapped EXACTLY in this JSON structure:
{
  "code": "<valid mermaid code as a single string>"
}
NO markdown, NO explanations.
`;
        }
    } catch (error) {
        console.warn("[Prompt Governance] Failed to dynamic skill file, falling back to default.", error.message);
    }

    return DEFAULT_AUTHORITY_PROMPT;
};

// Re-export constant for backward compatibility
export const DIAGRAM_AUTHORITY_PROMPT = DEFAULT_AUTHORITY_PROMPT;
