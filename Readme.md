# SRA (Smart Requirements Analyzer)

![Status](https://img.shields.io/badge/Status-V2_Verified-brightgreen)
![Pipeline](https://img.shields.io/badge/Strategy-5_Layer_Analysis-blue)
![SRA View](/assets/overview.png)

**SRA** is an intelligent, AI-powered ecosystem designed to automate and professionalize the software requirements engineering process. By leveraging a multi-layer analysis pipeline, it transforms raw project visions into high-fidelity IEEE-830 artifacts.

## 🚀 The 5-Stage Analysis Pipeline

SRA follows a rigid, automated pipeline to ensure requirement quality and architectural consistency.

```mermaid
graph LR
    L1[<b>Layer 1: Intake</b><br/>Raw Description] --> L2[<b>Layer 2: Validation</b><br/>AI Gatekeeper]
    L2 -->|PASS| L3[<b>Layer 3: Analysis</b><br/>IEEE SRS Generation]
    L2 -->|FAIL| L1
    L3 --> L4[<b>Layer 4: Refinement</b><br/>Chat & Patch]
    L4 --> L5[<b>Layer 5: Knowledge Base</b><br/>Shred & Reuse]
```

### 1. **Structured Intake** (Layer 1)
Translates free-text descriptions into an initial structured JSON model mapping to IEEE SRS sections.

### 2. **Validation Gatekeeper** (Layer 2)
An AI logic-check that ensures input is clear, consistent, and has sufficient detail before proceeding to heavy analysis.

### 3. **Final Analysis & SRS Generation** (Layer 3)
Generates the full SRS document, including User Stories, Acceptance Criteria, and UML/Mermaid diagrams.

### 4. **Iterative Refinement** (Layer 4)
Real-time chat interface to tweak requirements, automatically creating new versions and diffs.

### 5. **Knowledge Base Reuse** (Layer 5)
Finalized requirements are shredded into the Knowledge Base, allowing for optimized sub-second responses on recurring project patterns.

## ✨ Core Features

### 📊 Professional Analysis
-   **IEEE-830 Compliance**: Generates standardized sections from Introduction to Appendices.
-   **User Story Generator**: Standardized "As a... I want to... So that..." format.
-   **Acceptance Criteria**: Fine-grained success metrics for every feature.
-   **Entity Mapping**: Automated identification of data models.

### 🎨 Visual Modeling
-   **System Diagrams**: Automated generation of Sequence and Flowchart diagrams using Mermaid.js.
-   **Interactive Workspace**: Edit requirements in-place with real-time preview.

### 📦 Export & Portability
-   **Standardized PDF**: Professional export with Table of Contents and Revision History.
-   **Project Bundle**: Download zip containing diagrams, API docs, and raw JSON data.
-   **API Blueprint**: AI-generated Markdown contract for frontend/backend development.

### 🔒 Enterprise Ready
-   **Smart Versioning**: Branching and merging logic for requirements evolution.
-   **RBAC & Security**: Secure JWT authentication with Google/GitHub OAuth support.
-   **Background Queues**: Redis-backed asynchronous processing for complex AI tasks.

## 🛠️ Tech Stack

### Frontend
-   **Core**: [Next.js 15](https://nextjs.org/) (App Router), TypeScript.
-   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/), Radix UI.
-   **Visualization**: [Mermaid.js](https://mermaid.js.org/).

### Backend
-   **Runtime**: [Node.js](https://nodejs.org/) (Deployed to Vercel Serverless).
-   **Data**: [PostgreSQL](https://www.postgresql.org/) + [Prisma ORM](https://www.prisma.io/) (Supabase).
-   **Vector DB**: [pgvector](https://github.com/pgvector/pgvector) for Retrieval Augmented Generation (RAG).
-   **Async**: [Upstash QStash](https://upstash.com/docs/qstash/overall/getstarted) for Serverless Job Queues.
-   **AI**: [Google Gemini 2.5 Flash](https://ai.google.dev/).

## 🏁 Getting Started

Follow these steps to set up the project locally.

### Prerequisites
-   Node.js (v18 or higher)
-   npm or yarn
-   A Google Gemini API Key
-   Supabase Project (PostgreSQL + pgvector)
-   Upstash Account (Redis + QStash)

### 1. Backend Setup

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:

```env
# Server
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3001
ANALYZER_URL=http://localhost:3000/internal/analyze

# Database (Supabase)
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

# Authentication
JWT_SECRET=your_super_secret_jwt_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback

# AI
GEMINI_API_KEY=your_gemini_api_key_here

# Upstash QStash (Async Job Queue)
QSTASH_URL=https://qstash.upstash.io/v2/publish/
QSTASH_TOKEN=your_qstash_token
QSTASH_CURRENT_SIGNING_KEY=your_current_signing_key
QSTASH_NEXT_SIGNING_KEY=your_next_signing_key
```

Initialize the database:

```bash
npx prisma migrate dev --name init
```

Start the backend server:

```bash
npm run dev
```
The server will start on `http://localhost:3000`.

### 2. Frontend Setup

Open a new terminal, navigate to the frontend directory, and install dependencies:

```bash
cd frontend
npm install
```

Start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) to view the application.

## 📂 Project Structure

```
SRA/
├── backend/                # Express.js server
│   ├── prisma/
│   │   └── schema.prisma   # PostgreSQL database schema
│   ├── src/
│   │   ├── config/         # App configuration & OAuth
│   │   ├── controllers/    # API Request handlers
│   │   ├── middleware/     # Auth, Security, Error middleware
│   │   ├── routes/         # Express routes definitions
│   │   ├── services/       # AI (Gemini), Queue (Bull), & business logic
│   │   ├── workers/        # Background workers for analysis
│   │   ├── utils/          # Helper functions
│   │   └── app.js          # App setup
│   └── .env
│
├── frontend/               # Next.js 15 App
│   ├── app/                # App Router pages
│   │   ├── analysis/       # Analysis & History pages
│   │   ├── auth/           # Login/Signup pages
│   │   └── page.tsx        # Landing Page
│   ├── components/         # React Components
│   │   ├── ui/             # Shadcn UI primitives
│   │   ├── analysis-history.tsx
│   │   └── ...
│   └── .env.local
│
└── README.md
```

## 🗺️ Roadmap

- [x] **Social Login**: Google & GitHub OAuth.
- [x] **History**: Save and view past analyses.
- [x] **Security**: Rate limiting and payload validation.
- [x] **Export Options**: Export requirements to PDF, CSV, or Jira.
- [ ] **Custom Prompts**: Allow users to tweak the AI system prompt.
- [ ] **Dark Mode**: Full dark mode support for the UI (Partially implemented).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the Apache License - see the [LICENSE](LICENSE) file for details.
