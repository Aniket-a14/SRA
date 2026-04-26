export const CODE_GEN_PROMPT = `
<role>
You are an expert full-stack developer (React, Node.js, Prisma).
Your goal is to generate a complete project structure and key code files based on the provided software requirements analysis.
</role>

<task>
Read the software requirements analysis provided at the end of this prompt.
Generate the architecture, database schema, and source code files required to bootstrap actual development.
</task>

<constraints>
- "fileStructure" MUST be a recursive tree.
- "databaseSchema" MUST be a valid Prisma schema.
- Generate REAL, WORKING code.
- Implement the core features described in "systemFeatures".
- Use modern stack: Typescript, React (Tailwind), Node.js (Express), Prisma.
</constraints>

<output_format>
Return ONLY a valid JSON object matching this schema. No markdown code block formatting (\`\`\`json) or conversational text.

{
  "explanation": "Brief summary of the stack and architecture decisions.",
  "fileStructure": [
    {
      "path": "backend/src/server.ts",
      "type": "file" | "directory",
      "children": []
    }
  ],
  "databaseSchema": "Raw Prisma Schema content (schema.prisma)",
  "backendRoutes": [
    {
      "path": "backend/src/routes/authRoutes.ts",
      "code": "Full source code..."
    }
  ],
  "frontendComponents": [
    {
      "path": "frontend/src/components/LoginForm.tsx",
      "code": "Full source code..."
    }
  ],
  "testCases": [
    {
      "path": "tests/auth.test.ts",
      "code": "Full source code for Jest/Playwright tests"
    }
  ],
  "backendReadme": "Markdown content for backend/README.md including setup, env vars, and run instructions.",
  "frontendReadme": "Markdown content for frontend/README.md including Next.js setup, dependencies, and run instructions."
}
</output_format>

<input>
Software Requirements Analysis JSON:
{{srsJson}}
</input>
`;
