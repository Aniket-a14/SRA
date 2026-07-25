import { BaseAgent } from './BaseAgent.js';
import { RefinedIntentSchema } from '../utils/aiSchemas.js';
import { TEMPERATURES } from '../utils/llmGenerationConfig.js';

export class ProductOwnerAgent extends BaseAgent {
  constructor(providerConfig = {}) {
    super("Product Owner", providerConfig);
  }

  async refineIntent(userInput, settings = {}) {
    const { projectName = "Project" } = settings;

    const prompt = `
<role>
You are the business analyst running requirements elicitation. You are working from what a stakeholder actually said, which is usually incomplete and partly implicit, and your output is the agreed statement of intent that the whole specification is later derived from. Everything downstream inherits your errors, so you record what was said rather than what would make a tidier product.
</role>

<task>
Refine the following user request for the project "${projectName}" into a structured refined intent. Extract the core business goals, identify distinct system features, define user stories with acceptance criteria, and classify user roles.
</task>

<constraints>
1. Capture WHAT the product does and WHY. How it is built is a later decision and does not belong here.
2. Separate what the stakeholder stated from what you inferred. State something as intent only when it was said or is an unavoidable consequence of what was said.
3. Every feature traces to something in the request. If you cannot point to the wording that motivates a feature, it does not belong in scope.
4. User stories follow "As a [role], I want to [action], so that [benefit]." The role must be one you also list as a user role — stories for undefined actors are how scope leaks in.
5. Acceptance criteria are written as observable Given/When/Then statements: the precondition, the trigger, and the outcome a tester could witness. A criterion nobody can observe cannot be agreed to.
6. Priority reflects necessity, not enthusiasm — High means the product fails its stated purpose without it, Medium means it is expected but the product still functions, Low means it is desirable and deferrable.
7. Where the request is genuinely ambiguous, resolve it to the strongest supported reading and keep the scope narrow. Do not pad with features common to the product category but absent from this request.
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
    { "role": "As a team member", "action": "I want to create a task with a due date", "benefit": "so that I can track my work deadlines", "acceptanceCriteria": ["Given an open project, when the member submits a task with a title and due date, then the task appears in the project's first kanban column", "Given a task whose due date has passed, when the board is displayed, then that task is visually distinguished from tasks that are not overdue", "Given a task submitted with no title, when the member confirms, then the task is not created and the title field is reported as required"] }
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

    return this.callLLM(prompt, TEMPERATURES.productOwner, true, RefinedIntentSchema, 3, 5000, {
      maxOutputTokens: this.tokenLimits.mediumJson
    });
  }
}
