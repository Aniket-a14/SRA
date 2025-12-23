# SRA Frontend: Modern SRS Workspace

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-cyan)
![Radix UI](https://img.shields.io/badge/Radix%20UI-Primitives-white)

The SRA Frontend is a premium, type-safe Next.js 15 application designed to visualize and refine complex software requirements using a state-of-the-art interactive workspace.

## 💎 Design Philosophy & Standards

The frontend emphasizes **Visual Excellence** and **Absolute Type Safety**, ensuring a robust developer experience and a professional user interface.

-   **Zero-Error Standard**: The project maintains 100% clean linting (Zero errors, zero warnings in critical paths).
-   **Strict Typing**: Generic `any` types have been systematically replaced with precise interfaces derived from the backend's `SRSIntakeModel` and `Analysis` schemas.
-   **Responsive Aesthetics**: built with Tailwind CSS v4 and Framer Motion for fluid, high-fidelity transitions.

## 🛠️ Feature Breakdown

### The Analysis Workspace
The core of the application, orchestrating complex state across multiple tabs:
-   **`ResultsTabs`**: The main container managing synchronization between Diagrams, User Stories, and Appendix items.
-   **`KVDisplay`**: A modular component for rendering and editing key-value requirement pairs with auto-generated IDs.
-   **`MermaidViewer`**: Client-side rendering and high-res export of system diagrams.

### SRS Versioning & Diffing
-   **Visual Versioning**: Browse the project lineage via a dedicated timeline sidebar.
-   **Requirement Diffing**: Instant visual feedback of what changed between AI refinement cycles.

### Quality Audit Dashboard
Integrated directly into the workspace, providing real-time Feedback on:
-   Requirement clarity/vagueness.
-   Technical completeness.
-   Architectural consistency.

## 🚀 Tech Stack

-   **Framework**: [Next.js 15 (App Router)](https://nextjs.org/)
-   **Logic**: TypeScript (Strict Mode)
-   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
-   **UI primitives**: [Radix UI](https://www.radix-ui.com/)
-   **Visuals**: [Mermaid.js](https://mermaid.js.org/) & [Lucide](https://lucide.dev/)

## 📂 Architecture

```
frontend/
├── app/analysis/     # Core Workspace & Logic
├── components/
│   ├── ui/           # Design System primitives (Shadcn/Tailwind v4)
│   ├── analysis/     # Specialized workspace components
├── lib/
│   ├── auth-context  # Social & JWT Session Mgmt
│   ├── projects-api  # Type-safe API client
├── types/
│   ├── analysis.ts   # Shared Analysis & SRS definitions
```

## 🏁 Getting Started

1.  **Install Dependencies**:
    ```bash
    cd frontend && npm install
    ```

2.  **Environment Setup**:
    Create `.env.local`:
    ```env
    NEXT_PUBLIC_BACKEND_URL=http://localhost:3000/api
    ```

3.  **Start Development Server**:
    ```bash
    npm run dev
    ```

All production-ready code must pass the build and lint checks:
```bash
npm run lint
npm run build
```
