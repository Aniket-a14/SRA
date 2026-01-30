---
description: Run the full test suite for the SRA project
---

Use this workflow to ensure code quality and prevent regressions.

1. **Backend Tests**:
   - Navigate to the `backend` directory.
   - Run the tests:
     ```bash
     npm test
     ```

2. **Frontend Tests**:
   - Navigate to the `frontend` directory.
   - Run the tests:
     ```bash
     npm test
     ```

3. **Full System Verification**:
   - Ensure both frontend and backend are running.
   - Run end-to-end tests if available.

// turbo
4. **Quick Check**:
   Run the linting suite across the project:
   ```bash
   # Root level (if configured) or run individually
   cd backend && npm run lint && cd ../frontend && npm run lint
   ```
