# SRA Enterprise Demo & Walkthrough

This guide provides instructions on how to demonstrate the core capabilities of the SRA (Smart Requirements Analyst) 5-Layer Pipeline.

## 1. Setup & Launch
Ensure you have the application running locally via the "Getting Started" instructions in the [README](Readme.md).
-   Backend: `http://localhost:3000`
-   Frontend: `http://localhost:3001`

## 2. Authentication Flow
-   **Scenario**: A new user signs up.
-   **Action**: Click "Get Started" or "Login".
-   **Demo**:
    -   Show **Social Login** (Google/GitHub) for friction-less entry.
    -   Alternatively, create a demo account.

## 3. Creating a New Analysis (Layers 1 & 2)
-   **Scenario**: The user has a rough idea for an app.
-   **Action**:
    -   **Landing Page**: Enter a **Project Name** (e.g., "ZombieFitness") and a high-level description.
    -   *Example Prompt*: "I want a fitness tracking app that gamifies running with zombie audio stories. Users should be able to track runs, earn achievements, and share stats on social media."
    -   Click **"Analyze"**.
-   **Observation**:
    -   **Layer 1 (Intake)**: Structured data capture.
    -   **Layer 2 (Validation)**: The AI Gatekeeper validates the prompt for clarity.
    -   **Loading State**: Show the sleek loading UI while the background worker processes the request.

## 4. Exploring Results (Layer 3)
Once complete, the page redirects to the **Analysis Result Dashboard**.
-   **Project Header**: Verify the captured Project Name is displayed.
-   **Deep Dive Tabs**:
    -   **User Stories**: Standardized "As a... I want... So that..." format.
    -   **Diagrams (Strict Syntax)**:
        -   Switch to the **Diagrams** tab.
        -   **Action**: Click "View Syntax Explanation".
        -   **Observation**: Show the AI's explanation of why this diagram is valid (Proof of Diagram Syntax Authority).
        -   Interact with the Mermaid nodes.

## 5. Iterative Refinement (Layer 4)
-   **Scenario**: The user wants to add a missing feature.
-   **Action**: Open the **Refinement Chat** panel.
    -   *Input*: "Add a feature for premium users to download offline maps."
-   **Observation**:
    -   The **Refinement Service** processes the request.
    -   **Time Travel**: Use the **Version Timeline** sidebar to switch between Version 1 and Version 2, showing the added feature.

## 6. Finalizing & Exporting (Layer 5)
-   **Scenario**: The user is happy with the requirements.
-   **Action**: Click **"Finalize SRS"**.
-   **Outcome**:
    -   **Knowledge Base**: The content is "shredded" and stored for future recurrence patterns.
    -   **Export**: Click **Export PDF**.
    -   **Verification**: Explain that this PDF generation happens **client-side only** (Frontend-only Layer 5), ensuring no backend bottleneck.

## 7. Code Bundle
-   **Action**: Download the **Code Bundle** (Zip).
-   **Outcome**: Show that it contains the raw JSON data, diagrams, and API contracts.
