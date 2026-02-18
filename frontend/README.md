# SRA Frontend: Modern SRS Workspace

![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-cyan)
![Radix UI](https://img.shields.io/badge/Radix%20UI-Primitives-white)

The SRA Frontend is a premium, type-safe Next.js 16.1.6 application designed to visualize and refine complex software requirements using a state-of-the-art interactive workspace.

## 💎 Design Philosophy & Standards

The frontend emphasizes **Visual Excellence** and **Absolute Type Safety**, ensuring a robust developer experience and a professional user interface.

-   **Zero-Error Standard**: The project maintains 100% clean linting (Zero errors, zero warnings in critical paths).
-   **Strict Typing**: Generic `any` types have been systematically replaced with precise interfaces derived from the backend's `SRSIntakeModel` and `Analysis` schemas.
-   **Responsive Aesthetics**: built with Tailwind CSS v4 and Framer Motion for fluid, high-fidelity transitions.

## 🛠️ Feature Breakdown

### The Analysis Workspace
The core of the application, orchestrating complex state across modular tabs:
-   **`ResultsTabs`**: The main coordinator managing synchronization between specialized sub-tabs.
-   **`analysis/tabs/`**: Contains optimized components for Introduction, Features, Interfaces, NFRs, Appendices, Code, and Quality Audit.
-   **`MermaidViewer`**: Client-side rendering and high-res export of system diagrams.

### SRS Versioning & Diffing
-   **Visual Versioning**: Browse the project lineage via a dedicated timeline sidebar.
-   **Requirement Diffing**: Instant visual feedback of what changed between AI refinement cycles.

### Quality Audit Dashboard
Integrated directly into the workspace, providing real-time Feedback on:
-   Requirement clarity/vagueness.
-   Technical completeness.
-   Architectural consistency.

### 🛠️ Traceability & Audit (v4.0)
-   **Verification Badges**: Automated display of `VERIFIED`, `FAILED`, or `PENDING` statuses on feature cards.
-   **Implementation Mappings**: Direct links to local source files (synced via CLI) are visible in the Features tab.
-   **Enhanced PDF Export**: PDF reports now include an "Audit Trail" section for professional compliance.

## 🚀 Tech Stack

-   **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
-   **Logic**: TypeScript (Strict Mode)
-   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
-   **UI primitives**: [Radix UI](https://www.radix-ui.com/)
-   **Visuals**: [Mermaid.js](https://mermaid.js.org/) & [Lucide](https://lucide.dev/)

## 📂 Architecture

### Key Files

| Path | Purpose |
|------|---------|
| `app/analysis/page.tsx` | Main workspace entry point. Orchestrates data fetching and state. |
| `components/analysis/tabs/` | **Modular UI layer** for each SRS section (Features, NFRs, etc.). |
| `lib/hooks.ts` | **useAuthFetch**: Recommended hook for secure, authenticated API calls. |
| `types/analysis.ts` | Shared TypeScript definitions for SRS models. |

## 🏁 Getting Started

### Prerequisites

-   Node.js (v18+)
-   Backend running on port 3000

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | URL of the backend API (e.g., `http://localhost:3000/api`) |

### Installation

1.  **Install Dependencies**:
    ```bash
    cd frontend && npm install
    ```

2.  **Start Development Server**:
    ```bash
    npm run dev
    ```

3.  **Open Application**:
    Visit [http://localhost:3001](http://localhost:3001)

## 🔧 Troubleshooting

### Common Issues

**`Error: Can't resolve 'tailwindcss'`**
-   **Cause**: Node module resolution issues in Windows environments.
-   **Fix**: Ensure `tailwindcss` is listed in your dependencies and try running `npm install` again. If persistent, check for global vs local install conflicts.

**Linting Errors on Build**
-   **Cause**: We enforce `strict` mode. `any` types and unused variables will fail the build.
-   **Fix**: Run `npm run lint` locally and fix distinct type errors before committing.
