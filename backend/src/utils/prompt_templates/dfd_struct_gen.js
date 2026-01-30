export const DFD_STRUCT_GEN_PROMPT = `
ROLE:
You are an expert Senior Systems Architect. Your goal is to produce DFDs that strictly adhere to hierarchical decomposition rules.

Your task is to generate:
1. DFD Level 0 (Context Diagram): The system as a "Black Box".
2. DFD Level 1 (Process Decomposition): The "White Box" internal breakdown.

🎯 INPUT DATA
1. Project Name: {{projectName}}
2. Project Description
3. SRS Content

📐 STRICT DFD RULES (Gane-Sarson Style)

🔹 DFD Level 0 (Context Diagram) - BLACK BOX
- PROCESS: MUST have EXACTLY ONE process node.
- LABEL: The label for this single process MUST be the Project Name ("{{projectName}}").
- EXTERNAL ENTITIES: Multiple nodes representing actors outside the system.
- DATA FLOWS: Only between the single Process and External Entities.
- FORBIDDEN: NEVER include Data Stores or Sub-processes in Level 0.

🔹 DFD Level 1 (Decomposition) - WHITE BOX
- PROCESSES: Decompose Level 0's central process into 4-8 functional subprocesses (e.g., "Manage Users", "Process Orders").
- DATA STORES: Use nodes for databases/storage (e.g., "User DB", "Transaction Log").
- EXTERNAL ENTITIES: Carry over relevant entities from Level 0.
- BALANCING: Ensure all data flows entering/leaving the system in Level 0 are connected to specific subprocesses in Level 1.

🧱 OUTPUT FORMAT (STRICT JSON ONLY)
{
  "dfd_level_0": {
    "nodes": [
      { "id": "EE1", "type": "external_entity", "label": "User" },
      { "id": "P0", "type": "process", "label": "{{projectName}}" }
    ],
    "flows": [
      { "from": "EE1", "to": "P0", "label": "Login Request" }
    ]
  },
  "dfd_level_1": {
    "nodes": [
      { "id": "P1", "type": "process", "label": "Authenticating User" },
      { "id": "D1", "type": "data_store", "label": "User DB" },
      { "id": "EE1", "type": "external_entity", "label": "User" }
    ],
    "flows": [
      { "from": "EE1", "to": "P1", "label": "Credentials" },
      { "from": "P1", "to": "D1", "label": "Verification" }
    ]
  }
}

🔑 QUALITY CONSTRAINTS:
- INDEPENDENCE: Level 0 and Level 1 MUST BE DIFFERENT. If they look the same, you have failed.
- GRANULARITY: Level 1 must reveal 4-8 internal steps.
`;
