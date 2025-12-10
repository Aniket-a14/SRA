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

    | Variable | Description | Required |
    | :--- | :--- | :--- |
    | `GEMINI_API_KEY` | Your Google Gemini API key. | Yes |
    | `PORT` | The port the backend server listens on. Default is `3000`. | No |
    | `DATABASE_URL` | PostgreSQL connection string. | Yes |
    | `JWT_SECRET` | Secret key for JWT token generation. | Yes |
    | `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID for Google Authentication. | Yes |
    | `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret for Google Authentication. | Yes |
    | `GOOGLE_REDIRECT_URI` | OAuth 2.0 Redirect URI. | Yes |
    | `FRONTEND_URL` | URL of the frontend application (for CORS). | Yes |
    | `ANALYZER_URL` | URL for the internal analysis service. | Yes |
5.  Initialize the database:
    ```bash
    npx prisma generate
    npx prisma db push
    ```


## Project Structure

```
backend/
├── prisma/             # Database schema and migrations
├── src/
│   ├── config/         # App configuration
│   ├── controllers/    # Route controllers
│   ├── middleware/     # Custom middleware (auth, error)
│   ├── routes/         # API routes
│   ├── services/       # Business logic and external services
│   ├── utils/          # Utility functions
│   ├── app.js          # Express app setup
│   ├── index.js        # Entry point
│   └── server.js      
├── .env                # Environment variables
└── package.json
```
55: 
56: ## Usage


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
