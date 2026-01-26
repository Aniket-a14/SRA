# Pull Request

## 📖 Description
Please include a summary of the change and which issue is fixed.

## 🔄 Type of Change
- [ ] 🐛 **Bug Fix** (Non-breaking change which fixes an issue)
- [ ] ✨ **New Feature** (Non-breaking change which adds functionality)
- [ ] 💥 **Breaking Change** (Fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 **Documentation Update**
- [ ] 🎨 **Style/Refactor** (Code style, formatting, local variables)
- [ ] 🤖 **AI Model/Prompt Update** (Changes to system prompts or model configs)

## 🛡️ Governance Checklist
**All checks must be satisfied before merging.**

### Diagram Syntax Authority
- [ ] I have verified that any changes to diagram prompts in `src/utils/prompt_templates/` adhere to **strict Mermaid syntax**.
- [ ] I have verified the changes using the "View Syntax Explanation" feature in the frontend.
- [ ] **N/A**: This PR does not touch diagram generation logic.

### Architectural Integrity
- [ ] **Layer 5 (Document Compiler)**: I confirm that any changes to PDF generation are **Frontend-Only** (`export-utils.ts`) and contain NO backend dependencies.
- [ ] **Layer 4 (Refinement)**: Changes to refinement logic are correctly routed through the backend `refinementService`.

### Code Quality & Standards
- [ ] My code follows the code style of this project (ESLint/Prettier).
- [ ] I have used **shadcn/ui** components where applicable.
- [ ] I have removed all `console.log` statements.
- [ ] I have performed a self-review of my own code.

## 🧪 Verification
How did you verify this change?
- [ ] **Manual Verification**: (Describe steps below)
- [ ] **Unit Tests**: I have added/updated tests.
- [ ] **Snapshot Tests**: I have updated prompt snapshots (if applicable).

### Verification Steps
1.
2.
3.

## 📸 Screenshots (if applicable)

## 🔗 Related Issues
Fixes #

