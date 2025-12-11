# SRA Backend

This is the backend service for the Software Requirements Analyst (SRA) project. It provides a secure API to analyze text and generate software requirements, user stories, and Mermaid diagrams using Google's Gemini AI.

## ✨ Features

- **AI Analysis**: Powered by Google Gemini (`gemini-1.5-flash`).
- **Authentication**:
  - Email/Password (JWT)
  - Google OAuth 2.0
  - GitHub OAuth 2.0
- **Security**:
  - `helmet` for secure HTTP headers.
  - `express-rate-limit` for DDoS protection.
  - Robust Input Validation.
- **Database**: PostgreSQL with Prisma ORM.
- **Architecture**: Modular Service-Controller pattern.

## 🛠️ Prerequisites

- Node.js (v18+)
- npm
- PostgreSQL (Local or Cloud)
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

3.  **Environment Configuration**:
    Create a `.env` file in the `backend` directory:

    ```env
    # Server Configuration
    PORT=3000
    FRONTEND_URL=http://localhost:3001
    ANALYZER_URL=http://localhost:3000/internal/analyze

    # Database
    DATABASE_URL="postgresql://user:pass@localhost:5432/sra?schema=public"

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
