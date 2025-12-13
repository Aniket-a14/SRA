# SRA Backend

This is the backend service for the Software Requirements Analyst (SRA) project. It provides a secure API to analyze text and generate software requirements, user stories, and Mermaid diagrams using Google's Gemini AI.

## ✨ Features

- **Analysis Versioning**:
   - **Atomic Version Control**: Every chat interaction that modifies requirements creates a new, immutable version.
   - **History Tracking**: Full lineage tracking via `rootId` and `parentId` pointers.
   - **Diffing Engine**: Compare any two versions to see exactly what changed.
- **Context-Aware Chat**:
   - **Persistent History**: Chat context is preserved across the entire project version chain.
   - **Smart Updates**: The AI automatically proposes detailed JSON updates while maintaining conversation flow.
- **AI Resilience**:
   - **Automatic Retries**: Robust handling of transient AI errors (429/5xx) with exponential backoff.
   - **Timeout Protection**: Prevents hanging requests with enforced timeouts.
- **Authentication**:
  - Email/Password (JWT)
  - Google OAuth 2.0
  - GitHub OAuth 2.0
  - **Session Management**: Secure refresh tokens, session revocation, and multi-device support.
- **Quality Assurance**:
  - **Linting Engine**: automated requirement quality scoring (0-100).
  - **Ambiguity Detection**: Flags vague terms and missing metrics.
- **Queueing & Performance**:
  - **Asynchronous Processing**: Uses Bull Queue & Redis to handle long-running analysis tasks without blocking.
  - Rate Limiting & Input Validation.
- **Code Generation**:
  - **Full Pipeline**: Generates complete Schema, API Routes, Frontend Components, and Tests.
  - **Robust JSON Mode**: Ensures valid output structure.
- **Security & Reliability**:
  - `helmet` for secure HTTP headers.
  - `express-rate-limit` for DDoS protection.
  - **Robustness**: Centralized error middleware, request logging, and health checks.
- **Database**: PostgreSQL with Prisma ORM.

## 🛠️ Prerequisites

- Node.js (v18+)
- npm
- PostgreSQL (Local or Cloud)
- Redis Server (Required for Job Queue)
- A Google Gemini API Key

## 🚀 Installation & Setup

1.  **Clone & Navigate**:
    ```bash
    cd backend
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```
    *Note: A `postinstall` script will automatically run `prisma generate` to update the database client.*

3.  **Environment Configuration**:
    Create a `.env` file in the `backend` directory:

    ```env
    # Server Configuration
    NODE_ENV=development
    PORT=3000
    FRONTEND_URL=http://localhost:3001
    ANALYZER_URL=http://localhost:3000/internal/analyze
    ```

    # Database
    DATABASE_URL="postgresql://user:pass@localhost:5432/sra?schema=public"
    REDIS_URL="redis://127.0.0.1:6379"

    # Security
    JWT_SECRET=your_jwt_secret_key

    # Google OAuth
    GOOGLE_CLIENT_ID=your_google_client_id
    GOOGLE_CLIENT_SECRET=your_google_client_secret
    GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

    # GitHub OAuth
    GITHUB_CLIENT_ID=your_github_client_id
    GITHUB_CLIENT_SECRET=your_github_client_secret
    GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback

    # AI Service
    GEMINI_API_KEY=your_gemini_api_key
    ```

4.  **Database Migration**:
    Initialize the database and apply migrations (includes performance indexes):
    ```bash
    npx prisma migrate dev --name init
    ```

5.  **Start Server**:
    ```bash
    # Development (Hot Reload)
    npm run dev

    # Production
    npm start
    ```

## 📂 Project Structure

```
backend/
├── prisma/             # Database schema & migrations
├── src/
│   ├── config/         # OAuth & DB configuration
│   ├── controllers/    # API Controllers
│   ├── middleware/     # Auth, RateLimit, ErrorHandler
│   ├── routes/         # Express Routes
│   ├── services/       # Business Logic & AI integration
│   ├── utils/          # Helpers
│   ├── app.js          # App mounting
│   └── server.js       # Entry point
└── ...
```

## 🔗 API Endpoints

### Authentication

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/signup` | Register a new user. |
| `POST` | `/api/auth/login` | Login and receive a token. |
| `GET` | `/api/auth/google/start` | Initiate Google OAuth. |
| `GET` | `/api/auth/github/start` | Initiate GitHub OAuth. |
| `GET` | `/api/auth/me` | Get current user profile. |

### Analysis

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/analyze` | Submit text for analysis. |
| `GET` | `/api/analyze` | Get analysis history. |
| `GET` | `/api/analyze/:id` | Get specific analysis details. |

_Note: The API supports both `/api` prefix and root paths (e.g., `/auth/login` is also valid) for backward compatibility._

## 🔒 Security Measures

- **Rate Limiting**: Limited to 100 requests per 15 minutes per IP.
- **Input Validation**: Analysis text is capped at 20,000 characters.
- **Headers**: Secure headers enforced via Helmet.
