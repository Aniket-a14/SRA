# SRA Demo & Walkthrough

This guide provides instructions on how to demonstrate the core capabilities of the SRA (Smart Requirements Analyst) application.

## 1. Setup & Launch
Ensure you have the application running locally via the "Getting Started" instructions in the [README](Readme.md).
-   Backend: `http://localhost:3000`
-   Frontend: `http://localhost:3001`

## 2. Authentication Flow
-   **Scenario**: A new user signs up.
-   **Action**: Click "Get Started" or "Login".
-   **Demo**:
    -   Show **Social Login** (Google/GitHub) for friction-less entry.
    -   Alternatively, create a demo account (e.g., `demo@example.com`).

## 3. Creating a New Analysis
-   **Scenario**: The user has a rough idea for an app.
-   **Input**: Enter a high-level prompt in the main text area.
    -   *Example Prompt*: "I want a fitness tracking app that gamifies running with zombie audio stories. Users should be able to track runs, earn achievements, and share stats on social media."
-   **Action**: Click **"Analyze"**.
-   **Observation**:
    -   Show the **Loading State**: The UI provides feedback while the background worker processes the request.
    -   Once complete, the page redirects to the **Analysis Result Dashboard**.

## 4. Exploring Results
Walk through the generated tabs:
-   **Deep Dive**: Requirements are broken down into Functional & Non-Functional.
-   **User Stories**: Check the "As a... I want... So that..." format and Acceptance Criteria.
-   **Diagrams**: Switch to the **Diagrams** tab to see the auto-generated Mermaid Flowchart and Sequence Diagram.
    -   *Demo*: Click nodes in the diagram to show interactivity.
-   **Schema & API**: Show the proposed Database Schema and API Routes.

## 5. Iterative Refinement (Versioning)
-   **Scenario**: The user wants to add a missing feature.
-   **Action**: Open the **Chat** panel (usually on the right or bottom).
    -   *Input*: "Add a feature for premium users to download offline maps."
-   **Observation**:
    -   The AI acknowledges the request.
    -   A **New Version** is created (e.g., Version 2).
    -   The UI highlights the **Diff** (changes made).
-   **Validation**: Use the **Timeline** sidebar to switch back to Version 1, then forward to Version 2 to demonstrate "Time Travel".

## 6. Exporting
-   **Scenario**: The user needs to share this with their team.
-   **Action**: Click the **Export** button.
-   **Outcome**:
    -   Generate a **PDF** report.
    -   Download the **Code Bundle** (Zip) to start coding immediately.
