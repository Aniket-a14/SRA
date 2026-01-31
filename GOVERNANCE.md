# SRA Governance & Branch Protection

To maintain enterprise-grade stability and security, SRA enforces strict governance rules for the `main` branch.

## 🛡️ Main Branch Protection Rules

The following rules must be configured in the GitHub repository settings (`Settings > Branches > Add protection rule`):

### 1. Require Pull Request Reviews
- **Rule**: Require at least **1 approving review** before merging.
- **Rationale**: Ensures code quality and provides a secondary layer of "PII Redaction" review.

### 2. Require Status Checks to Pass
- **Workflow Dependencies**: Before merging into `main`, the following checks must pass:
    - `Frontend CI / build-and-test`
    - `Backend CI / build-and-test`
    - `OpenAPI Contract Lint / lint`
    - `Linting Quality / lint`
- **Rationale**: Guarantees that the architectural contract and production builds remain unbroken.

### 3. Restrict Force Pushes
- **Rule**: Enable **Restrict push** and **Block force pushes**.
- **Rationale**: Prevents destructive history rewriting on the production branch.

### 4. Require Signed Commits
- **Rule**: **Require signed commits**.
- **Rationale**: Ensures the identity of the contributor and prevents spoofing.

## 🚀 Release Management

- **Versioning**: Follow [Semantic Versioning (SemVer)](https://semver.org/).
- **Tags**: Automated via the `auto-tag.yml` workflow when a PR is merged into `main`.
- **Change Logs**: Maintain a high-fidelity [CHANGELOG.md](CHANGELOG.md).

## 🏛️ Architectural Gatekeeping

All contributions involving the **Analysis Pipeline** or **AI Prompt Templates** (`backend/src/utils/prompt_templates/`) require explicit sign-off from the Architect persona (Repository Maintainer).
