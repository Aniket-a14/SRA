# Contributing to SRA

First off, thanks for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to SRA. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## 📂 Project Structure & Navigation

Understanding the project structure is key to making effective contributions.

### Backend (`/backend`)
The backend is built with **Node.js** and **Express**.
-   **`src/index.js`**: The main entry point. This file contains the server setup, API routes, and the integration logic with Google Gemini.
-   **`.env`**: Stores environment variables like your API key. **Do not commit this file.**

### Frontend (`/frontend`)
The frontend is built with **Next.js 15 (App Router)** and **TypeScript**.
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
3.  Create a `.env` file and add your API key:
    ```env
    GEMINI_API_KEY=your_gemini_api_key_here
    PORT=3000
    ```
4.  Start the development server:
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
-   **Backend Logic**: If you're adding a new AI capability or API endpoint, modify `backend/src/index.js`.
-   **Frontend UI**:
    -   To add a new section to the results, update `frontend/components/ResultsTabs.tsx`.
    -   To change the input form, check `frontend/components/InputSection.tsx` (if applicable) or the main page `frontend/app/page.tsx`.

### Styling
-   We use **Tailwind CSS**. You can apply utility classes directly to your JSX elements.
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
