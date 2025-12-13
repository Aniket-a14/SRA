# SRA Frontend

The frontend interface for the Software Requirements Analyst (SRA) system. Built with Next.js 15, it provides a modern, interactive dashboard for generating and viewing software requirements, now with enhanced security and social login features.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Components**: [Shadcn/ui](https://ui.shadcn.com/) (Radix UI)
- **Notifications**: [Sonner](https://sonner.emilkowal.ski/)
- **Visuals**: Framer Motion (Animations), Lucide React (Icons), Mermaid.js (Diagrams)
- **Utilities**: `jspdf` (PDF Generation), `jszip` (Bundling), `html-to-image` (Diagram Export)

## ✨ Features

- **Project Dashboard**: Central hub for managing analyses.
- **Interactive Version Control**:
  - **Version Timeline**: Sidebar navigation to browse past iterations of your analysis.
  - **Visual Diff Viewer**: See what changed between versions (Added/Removed/Modified Requirements).
- **Persistent AI Chat**:
  - **Context Retention**: Chat history "follows" you across versions.
  - **Smart Commands**: Ask for specific component updates (e.g., "Add a login button").
- **Detailed Results View**:
  - **Overview Tab**: Dashboard with identified entities, missing logic warnings, and contradiction alerts.
  - **Requirements**: Functional & Non-functional lists.
  - **User Stories**: Agile-ready stories with acceptance criteria.
  - **Diagrams**: Interactive **Mermaid Editor** for Flowcharts and Sequence diagrams.
  - **Quality Audit**: Dedicated tab for quality scoring and specific improvement suggestions.
  - **API Specs**: Proposed API contracts.
  - **Generated Code**: Syntax-highlighted code explorer with regeneration options.
- **Export & Share**:
    - **Download Bundle**: Zip file with all assets (PDF, JSON).
    - **Image Export**: Convert diagrams to high-res PNGs via `html-to-image`.
    - **Codebase Export**: Download the generated project code.
- **Analysis History**: Full version history UI to browse and revert changes.
- **Authentication**:
  - Email/Password.
  - **Social Login**: Google and GitHub.
- **User Experience**:
  - **Dark Mode**: Fully themed UI.
  - **Animations**: Scroll animations and fluid transitions.
  - Global Toast Notifications (Success/Error).
  - Responsive, beautiful UI.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Backend running on port 3000 (default)

### Installation

1.  **Install dependencies**:
    ```bash
    cd frontend
    npm install
    ```

2.  **Environment Setup**:
    Create a `.env.local` file:

    ```env
    NEXT_PUBLIC_BACKEND_URL=http://localhost:3000/api
    ```
    *(Note: The backend supports `http://localhost:3000/api` or `http://localhost:3000`)*

3.  **Start Development Server**:
    ```bash
    npm run dev
    ```

    The app will be available at [http://localhost:3001](http://localhost:3001).

## 📂 Project Structure

```
frontend/
├── app/              # Next.js App Router pages
│   ├── (auth)/       # Login, Signup (with Social Auth)
│   ├── analysis/     # Analysis Results & History
│   ├── error/        # Error handling pages
│   └── page.tsx      # Landing page
├── components/       # React components
│   ├── ui/           # Reusable UI primitives (Shadcn)
│   ├── ...           # Feature components (Navbar, Hero, etc.)
├── lib/              # Utilities (Auth context, API helpers)
└── package.json
```

## 🔒 Security

- **Secure Auth**: Token-based authentication integration.
- **Protected Routes**: Middleware protects dashboard and analysis pages.
- **Input Handling**: Clean interfaces that respect backend validation limits.

## 🤝 Contributing

Run the linter before pushing changes:
```bash
npm run lint
```
