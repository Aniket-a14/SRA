# SRA Backend

This is the backend service for the Software Requirements Analyst (SRA) project. It provides an API to analyze text and generate software requirements, user stories, and Mermaid diagrams using Google's Gemini AI.

## Prerequisites

- Node.js (v18 or higher recommended)
- npm
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

### POST /analyze

Analyzes the provided text and returns structured software requirements.

**Request URL:** `http://localhost:3000/analyze`

**Headers:**
- `Content-Type: application/json`

**Body:**

```json
{
  "text": "Description of your software project..."
}
```

**Response (Success - 200 OK):**

Returns a JSON object containing:
- `cleanedRequirements`: Refined requirement text.
- `functionalRequirements`: List of functional requirements.
- `nonFunctionalRequirements`: List of non-functional requirements.
- `entities`: List of identified entities.
- `userStories`: List of user stories.
- `acceptanceCriteria`: Acceptance criteria for stories.
- `flowchartDiagram`: Mermaid code for the flowchart diagram.
- `sequenceDiagram`: Mermaid code for the sequence diagram.
- `apiContracts`: Proposed API endpoints.
- `missingLogic`: Identified gaps in logic.

**Response (Error - 400 Bad Request):**

```json
{
  "error": "Text input required."
}
```

**Response (Error - 500 Internal Server Error):**

```json
{
  "error": "AI processing failed",
  "details": "Error message details..."
}
```
