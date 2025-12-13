# Contributing to SRA

![Project Overview](assets/overview.png)


First off, thanks for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to SRA. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## 📂 Project Structure & Navigation

Understanding the project structure is key to making effective contributions.

### Backend (`/backend`)
The backend is built with **Node.js** and **Express**.
-   **`src/server.js`**: The main entry point to start the server.
-   **`src/app.js`**: Express app configuration.
-   **`src/config/`**: App configuration and OAuth setup.
-   **`src/routes/`**: API route definitions.
-   **`src/controllers/`**: Logic for handling API requests.
-   **`src/services/`**: Business logic and AI integration.
-   **`src/workers/`**: Background workers for handling async tasks.
-   **`src/middleware/`**: Middleware for auth, validation, and error handling.
-   **`.env`**: Stores environment variables like your API key and database URL. **Do not commit this file.**

### Frontend (`/frontend`)
The frontend is built with **Next.js 15 (App Router)** and **TypeScript**, styled with **Tailwind CSS v4**.
-   **`app/`**: Contains the application routes and pages.
    -   `page.tsx`: The main landing page and UI.
    -   `layout.tsx`: The root layout wrapper.
-   **`components/`**: Reusable UI components.
    -   `ui/`: Base components from shadcn/ui (buttons, inputs, cards).
    -   `ResultsTabs.tsx`: Displays the analysis results.
    -   `MermaidRenderer.tsx`: Renders the diagrams.
-   **`lib/`**: Utility functions and helpers.
-   **`public/`**: Static assets like images and icons.

## 🚀 Getting Started

### Prerequisites
Ensure you have the following installed:
-   **Node.js** (v18 or higher)
-   **npm** (comes with Node.js)
-   **PostgreSQL** (for the database)
-   **Redis** (for the background job queue)
-   A **Google Gemini API Key** (Get one [here](https://aistudio.google.com/app/apikey))

### Backend Setup
1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Create a `.env` file and add the following variables:
    ```env
    # Server
    NODE_ENV=development
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
4.  Initialize the database:
    ```bash
    npx prisma migrate dev --name init
    ```
5.  Start the development server:
    ```bash
    npm run dev
    ```

### Frontend Setup
1.  Open a new terminal and navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```
4.  Open [http://localhost:3001](http://localhost:3001) to view the app.

## 🛠️ Where to Make Changes

### Adding New Features
-   **Backend Logic**:
    -   Add new routes in `src/routes/`.
    -   Implement logic in `src/controllers/` and `src/services/`.
-   **Frontend UI**:
    -   To add a new section to the results, update `frontend/components/ResultsTabs.tsx`.
    -   To change the input form, check `frontend/app/page.tsx`.

### Styling
-   We use **Tailwind CSS v4**. You can apply utility classes directly to your JSX elements.
-   For complex components, check `frontend/components/ui` to see if a pre-built component (like a Button or Card) already exists.

## 🔄 Contribution Workflow

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** locally:
    ```bash
    git clone https://github.com/your-username/SRA.git
    cd SRA
    ```
3.  **Create a branch** for your feature or fix:
    ```bash
    git checkout -b feature/amazing-new-feature
    ```
4.  **Make your changes**.
5.  **Commit your changes** with a descriptive message:
    ```bash
    git commit -m "Add amazing new feature to results display"
    ```
6.  **Push to your fork**:
    ```bash
    git push origin feature/amazing-new-feature
    ```
7.  **Open a Pull Request** on the original repository.

## 🐛 Reporting Issues

If you find a bug or have a feature request, please open an issue on GitHub. Be sure to include:
-   Steps to reproduce the bug.
-   Expected behavior vs. actual behavior.
-   Screenshots (if applicable).

Happy Coding! 🚀
