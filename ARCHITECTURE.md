# System Architecture

## Overview

The SRA (Smart Requirements Analyst) system is designed as a modern, event-driven web application that leverages Generative AI to automate the software requirements engineering process. It follows a client-server architecture with a decoupled asynchronous worker for heavy AI processing.

```mermaid
graph TD
    User[User] -->|Interacts| Client[Frontend (Next.js 15)]
    Client -->|REST API| API[Backend API (Express)]
    
    subgraph "Backend Services"
        API -->|Auth| Auth[Auth Service]
        API -->|CRUD| DB[(PostgreSQL)]
        API -->|Enqueue Job| Queue[Redis Job Queue]
        
        Worker[Background Worker] -->|Polls| Queue
        Worker -->|Updates| DB
    end
    
    subgraph "AI Integration"
        Worker -->|Request| AIService[AI Service Layer]
        AIService -->|Abstracted Call| Gemini[Google Gemini]
        AIService -->|Abstracted Call| OpenAI[OpenAI (Optional)]
    end
```

## Core Components

### 1. Frontend Client
Built with **Next.js 15 (App Router)** and **TypeScript**, the frontend provides a responsive Single Page Application (SPA) experience.
-   **State Management**: Uses React Server Components and Client Components for optimal performance.
-   **UI Library**: Shadcn/ui (Radix Primitives) + Tailwind CSS v4.
-   **Visualization**: Renders Mermaid.js diagrams dynamically on the client side.

### 2. Backend API
The backend is a **Node.js/Express** application serving a RESTful API.
-   **Security**: Implements Helmet, Rate Limiting, and JWT/OAuth authentication.
-   **ORM**: Uses **Prisma** for type-safe database interactions.
-   **Queueing**: Utilizes **Bull** (Redis-based queue) to offload long-running AI analysis tasks, preventing request timeouts and ensuring scalability.

### 3. AI Service Layer & Multi-Model Support
The system implements a **Provider Pattern** in `src/services/aiService.js` to abstract the underlying AI Model.
-   **Default Provider**: Google Gemini 2.5 Flash (Optimized for speed/cost).
-   **Secondary Provider**: OpenAI GPT-4o (Supported via configuration).
-   **Mechanism**: The service accepts a `settings` object containing the preferred `modelProvider` and `modelName`. It normalizes the prompt and response format, ensuring the rest of the application remains agnostic to the specific AI model being used.

## Versioning System

One of the core features of SRA is its ability to track the evolution of requirements. This is implemented via a **Linked List / Tree** structure in the PostgreSQL database.

### Data Model
The `Analysis` entity in `schema.prisma` contains the following fields to enable versioning:
-   **`id`**: Unique identifier for the specific version.
-   **`rootId`**: Points to the original ancestor of the analysis chain. All versions of a project share the same `rootId`.
-   **`parentId`**: Points to the immediate predecessor. This creates a linked history.
-   **`version`**: An incremental integer (1, 2, 3...) for easy user reference.

### How it Works
1.  **Creation**: The first analysis has `version: 1`, `rootId: self`, and `parentId: null`.
2.  **Refinement**: When a user chats with the AI to refine requirements, a **new** `Analysis` record is created.
    -   It copies valid data from the parent.
    -   It applies the AI-generated changes (JSON Patch or full replacement).
    -   It links back via `parentId`.
3.  **Time Travel**: The frontend fetches the lineage using `rootId` to display a navigable timeline. Users can "branch" off any previous point by refining an older version.

## API Surface

| Service | Base Route | Description |
| :--- | :--- | :--- |
| **Auth** | `/api/auth` | Handling Login, Signup, OAuth (Google/GitHub). |
| **Analysis** | `/api/analyze` | Core endpoints for creating and retrieving analyses. |
| **Project** | `/api/projects` | Managing grouped analyses and user settings. |
