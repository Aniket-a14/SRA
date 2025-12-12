# SRA (Smart Requirements Analyzer)

![SRA View](/assets/overview.png)

**SRA** is an intelligent, AI-powered tool designed to streamline the software requirements engineering process. By leveraging Google's Gemini AI, it analyzes raw project descriptions and automatically generates comprehensive technical documentation, including functional requirements, user stories, acceptance criteria, and visual diagrams.

## 🚀 How It Works

1.  **Input**: The user provides a high-level description of their software project in the web interface.
2.  **Analysis**: The backend sends this text to the Google Gemini API with a specialized prompt to extract structured requirements.
3.  **Generation**: The AI returns a structured JSON response containing categorized requirements, entities, and Mermaid.js diagram code.
4.  **Visualization**: The frontend parses this data and renders it into interactive tabs, formatted lists, and dynamic diagrams.

## 🛠️ Tech Stack

### Frontend
-   **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
-   **Language**: TypeScript
-   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
-   **UI Components**: [Radix UI](https://www.radix-ui.com/) (via [shadcn/ui](https://ui.shadcn.com/))
-   **Notifications**: [Sonner](https://sonner.emilkowal.ski/)
-   **Icons**: [Lucide React](https://lucide.dev/)
-   **Diagrams**: [Mermaid.js](https://mermaid.js.org/)

### Backend
-   **Runtime**: [Node.js](https://nodejs.org/)
-   **Framework**: [Express.js](https://expressjs.com/)
-   **Database**: [PostgreSQL](https://www.postgresql.org/)
-   **ORM**: [Prisma](https://www.prisma.io/)
-   **Authentication**: [JWT](https://jwt.io/), [Google OAuth](https://developers.google.com/identity/protocols/oauth2), [GitHub OAuth](https://docs.github.com/en/apps/oauth-apps)
-   **Security**: `helmet`, `express-rate-limit`, `express-validator`
-   **AI Integration**: [Google Gemini 2.5 Flash](https://ai.google.dev/) (via `@google/generative-ai`)
-   **Queueing**: [Bull](https://github.com/OptimalBits/bull) & [Redis](https://redis.io/) (Asynchronous Processing)

## ✨ Features

-   **Requirement Extraction**: Automatically identifies and categorizes Functional and Non-Functional requirements.
-   **User Story Generation**: Creates standard user stories with "As a... I want to... So that..." format.
-   **Acceptance Criteria**: Defines clear success metrics for each user story.
-   **Code Generation**: Generates a full starter codebase (schema, routes, simple frontend) based on requirements.
-   **Visual Modeling**:
    -   **Flowchart Diagrams**: Visualizes actors and their interactions with the system.
    -   **Sequence Diagrams**: Shows the flow of logic and data between system components.
-   **Entity Recognition**: Identifies key data entities and their attributes.
-   **API Contract Proposal**: Suggests potential API endpoints based on the requirements.
-   **Export & Download**:
    -   **SRS PDF**: standardized requirements document.
    -   **Project Bundle**: Includes diagrams (PNG/SVG), API docs, and JSON data.
    -   **Codebase Zip**: Download the AI-generated starter code.
-   **Security & Performance**:
    -   Rate Limiting to prevent abuse.
    -   Secure HTTP headers.
    -   Robust input validation.
    -   **Background Job Queue**: Handles heavy AI analysis tasks asynchronously using Redis.
-   **User System**:
    -   Secure User Authentication (Register/Login).
    -   Social Login (Google & GitHub).
    -   Analysis History tracking.

## 🏁 Getting Started

Follow these steps to set up the project locally.

### Prerequisites
-   Node.js (v18 or higher)
-   npm or yarn
-   A Google Gemini API Key
-   PostgreSQL Database
-   Redis Server (Required for Job Queue)

### 1. Backend Setup

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:

```env
# Server
PORT=3000
FRONTEND_URL=http://localhost:3001
ANALYZER_URL=http://localhost:3000/internal/analyze

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/sra_db?schema=public"
REDIS_URL="redis://127.0.0.1:6379"

# Auth
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

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
