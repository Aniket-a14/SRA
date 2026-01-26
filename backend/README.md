# SRA Backend: 5-Layer Analysis Engine

![Node.js](https://img.shields.io/badge/Node.js-v18.x-green)
![Express](https://img.shields.io/badge/Express-v4.x-lightgrey)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)
![Redis](https://img.shields.io/badge/Redis-Upstash-red)

The SRA Backend is a high-performance Express.js ecosystem powered by Google Gemini, designed to orchestrate the transition from raw project intent to validated IEEE-830 requirements.

## 🏗️ 5-Layer Service Architecture

Our core logic is partitioned into five distinct service layers for maximum reliability and scalability.

```mermaid
graph TD
    A[API Controllers] -->|Publish| Q[Upstash QStash]
    Q -->|Webhook| W[Serverless Worker Services]

    subgraph "The Analysis Pipeline"
        W --> L1[IntakeService<br/>Structural Mapping]
        L1 --> L2[ValidationService<br/>Quality Gate]
        L2 -->|PASS| L3[AnalysisService<br/>IEEE SRS Gen]
        L3 --> L4[RefinementService<br/>Context Patching]
        L4 --> L5[KnowledgeBaseService<br/>Shred & Reuse]
    end
```

### 1. **IntakeService** (Structural Mapping)
Translates unstructured text into the `SRSIntakeModel`. This ensures that even early-stage inputs occupy a structured schema before complex AI analysis begins.

### 2. **ValidationService** (The Gatekeeper)
Runs a dedicated "Quality Audit" on the Intake model. It scores requirements for ambiguity and completeness. Only high-confidence models proceed to Layer 3.

### 3. **AnalysisService** (IEEE Construction)
The heavy-lifter. Consumes validated intake data to generate a complete SRS including user stories, acceptance criteria, and Mermaid diagrams.

### 4. **RefinementService** (Context Patching)
Handles iterative improvements via chat. It uses a "context-injection" strategy to inform the AI of existing project state while applying new user directives.

### 5. **KnowledgeBaseService** (KB Shredder)
Shreds finalized analyses into semantic chunks. Implements the "Hash-and-Match" strategy for Layer 5 reuse, enabling sub-second response times for identical project descriptions.

## 🛠️ Performance & Reliability

### Background Processing
-   **Upstash QStash**: Serverless async messaging for scalable AI operations.
-   **Atomic Responses**: Users receive immediate "Analysis Started" responses, with progress updates delivered via subsequent polling.

### AI Robustness
-   **Dynamic Provider Switching**: Abstraction layer supports Gemini 2.5 and OpenAI GPT-4o.
-   **Error Backoff**: Automated exponential backoff for 429 (Rate Limit) and 5xx (AI Downtime) errors.

## 📂 Architecture

### Key Files

| Path | Purpose |
|------|---------|
| `src/app.js` | Express app configuration and middleware setup. |
| `src/controllers/analysisController.js` | Main entry point for starting analysis and handling refinements. |
| `src/services/geminiService.js` | Wrapper for Google Gemini API interactions. |
| `src/workers/analysisWorker.js` | Background worker that executes the heavy AI analysis tasks. |
| `prisma/schema.prisma` | Database schema definition (PostgreSQL). |

### Dependencies

-   **Upstream**: None (Entry point for the system).
-   **Downstream**:
    -   **PostgreSQL**: Persistence for Users, Projects, and Analysis history.
    -   **Upstash QStash**: Async task queue for reliable long-running processes.
    -   **Google Gemini**: Intelligence provider for all requirement generation.

## 🚀 Setup & Deployment

### Prerequisites
-   Node.js (v18+) & npm
-   PostgreSQL (Database)
-   Upstash QStash (Serverless Queue)
-   Gemini API Key

### Installation

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Environment Configuration**:
    Configure `.env` (seed variable table in root README).

3.  **Database Migration**:
    ```bash
    npx prisma migrate dev
    ```

4.  **Start Server**:
    ```bash
    npm run dev
    ```

## 🔧 Troubleshooting

### Common Issues

**`429 Too Many Requests` (AI)**
-   **Cause**: You have hit the rate limit for the Google Gemini API.
-   **Fix**: Wait a minute and retry. The system has built-in backoff, but frequent retries may still be blocked.

**Analysis Stuck in `PENDING`**
-   **Cause**: The QStash webhook is not reaching your local machine.
-   **Fix**: Ensure your local server is exposed to the internet (e.g., using ngrok) or you are testing in a cloud environment where QStash can reach the `ANALYZER_URL`.

**Prisma Connection Error**
-   **Cause**: Incorrect `DATABASE_URL`.
-   **Fix**: Check your `.env` file and ensure the Supabase connection string is correct and the database is active.

## 🔗 Key API Domains

| Domain | Controller | Description |
| :--- | :--- | :--- |
| **Auth** | `authController` | JWT, Google/GitHub OAuth, Session Mgmt |
| **Analysis** | `analysisController` | Layer 1-3 creation and Layer 4 refinements |
| **Knowledge** | `knowledgeController` | Layer 5 finalization and reuse queries |

## 🧪 Integration Testing

We maintain high coverage of the analysis layers via specialized integration scripts:

-   `test-layer1-integration.js`: Verifies intake structured mapping.
-   `test-validation-integration.js`: Benchmarks the AI gatekeeper accuracy.
-   `test-layer5-integration.js`: Confirms Knowledge Base shredding and hash-reuse consistency.
