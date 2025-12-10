# SRA Backend

This is the backend service for the Software Requirements Analyst (SRA) project. It provides an API to analyze text and generate software requirements, user stories, and Mermaid diagrams using Google's Gemini AI.

## Prerequisites

- Node.js (v18 or higher recommended)
- npm
- PostgreSQL (Local or Cloud)
- A Google Gemini API Key

## Installation

1.  Clone the repository.
2.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  Create a `.env` file in the root directory and add your Gemini API key:
    ```env
    GEMINI_API_KEY=your_api_key_here
    PORT=3000
    DATABASE_URL="postgresql://user:password@localhost:5432/sra_db?schema=public"
    JWT_SECRET=your_jwt_secret_key
    FRONTEND_URL=http://localhost:3001
    ```
5.  Initialize the database:
    ```bash
    npx prisma generate
    npx prisma db push
    ```

## Usage

### Development

To start the server in development mode with hot reloading:

```bash
npm run dev
```

### Production

To start the server in production mode:

```bash
npm start
```

The server will start on port 3000 (or the port specified in your `.env` file).

## API Documentation

## API Documentation

### Auth Endpoints

#### POST /auth/register
Register a new user.
- **Body**: `{ "email": "...", "password": "...", "name": "..." }`

#### POST /auth/login
Login and receive a JWT cookie.
- **Body**: `{ "email": "...", "password": "..." }`

### Analysis Endpoints

All analysis endpoints require authentication (Cookie).

#### POST /analyze
Analyzes the provided text and returns structured software requirements.
- **Body**: `{ "text": "Description of your software project..." }`
- **Response**: JSON object with requirements, user stories, mermaid code, etc.

#### GET /analyze
Get the analysis history for the logged-in user.
- **Response**: List of past analyses (ID, Input Text, Timestamp).

#### GET /analyze/:id
Get the full details of a specific analysis.
- **Response**: Full analysis JSON object.

### Internal
#### POST /internal/analyze
Direct AI endpoint (used for testing or internal services).
