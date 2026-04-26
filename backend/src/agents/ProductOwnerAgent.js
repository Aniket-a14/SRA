import { BaseAgent } from './BaseAgent.js';
import { RefinedIntentSchema } from '../utils/aiSchemas.js';

export class ProductOwnerAgent extends BaseAgent {
  constructor() {
    super("Product Owner");
  }

  async refineIntent(userInput, settings = {}) {
    const { projectName = "Project" } = settings;

    const prompt = `
<role>
You are a Senior Business Analyst with expertise in product discovery and requirements engineering. You specialize in transforming vague stakeholder requests into structured, actionable product definitions that bridge business intent with engineering feasibility.
</role>

<task>
Refine the following user request for the project "${projectName}" into a structured refined intent. Extract the core business goals, identify distinct system features, define user stories with acceptance criteria, and classify user roles.
</task>

<constraints>
1. Focus on WHAT the product does and WHY, never on HOW it is built.
2. Do NOT invent features that are not explicitly stated or logically implied by the input.
3. Every feature must be traceable to a phrase or intent in the original user request.
4. User stories must follow the format: "As a [role], I want to [action], so that [benefit]."
5. Acceptance criteria must be specific, measurable, and testable.
6. Prioritize features as High, Medium, or Low based on their centrality to the core product purpose.
7. If the input is vague, extract the strongest signal and derive a focused scope — do not pad with generic features.
</constraints>

<examples>
<example>
<input>A task management app where teams create projects and track tasks with due dates on a kanban board</input>
<output>
{
  "projectTitle": "Task Management App",
  "scopeSummary": "A collaborative task management platform enabling teams to organize work through projects, tasks with deadlines, and visual kanban-based progress tracking.",
  "features": [
    { "name": "Project Management", "description": "Users create and configure projects as containers for related tasks.", "priority": "High" },
    { "name": "Task Lifecycle", "description": "Users create tasks with titles, descriptions, due dates, and assignees within projects.", "priority": "High" },
    { "name": "Kanban Board", "description": "Visual board interface displaying tasks organized by status columns with drag-and-drop reordering.", "priority": "High" }
  ],
  "userStories": [
    { "role": "As a team member", "action": "I want to create a task with a due date", "benefit": "so that I can track my work deadlines", "acceptanceCriteria": ["Task form accepts title, description, due date, and assignee", "Created task appears in the correct kanban column", "Overdue tasks are visually distinguished"] }
  ]
}
</output>
</example>
</examples>

<input>
Project: "${projectName}"
User Request:
"${userInput}"
</input>
`;

    return this.callLLM(prompt, 0.7, true, RefinedIntentSchema);
  }
}
