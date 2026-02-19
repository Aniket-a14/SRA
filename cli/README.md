# SRA CLI 🚀
[![Socket Badge](https://badge.socket.dev/npm/package/@sra-srs/sra-cli/4.0.3)](https://badge.socket.dev/npm/package/@sra-srs/sra-cli/4.0.3)
> **Bridging Requirements and Code through Spec-Driven Development.**

SRA CLI is a professional-grade command-line tool designed to keep your software implementation in perfect sync with your Software Requirements Specification (SRS). It enables automated compliance checking, specification syncing, and verification traceability.

---

## 📦 Installation

Install globally via npm:

```bash
npm install -g @sra-srs/sra-cli
```

Or run instantly without installation:

```bash
npx @sra-srs/sra-cli init
```

---

## 🛠️ Prerequisites

- **Node.js**: v18.0.0 or higher.
- **API Key**: Generate one from your SRA Platform Dashboard.
- **Environment**: Create a `.env` file in your project root:
  ```env
  SRA_API_KEY=sra_live_your_key_here
  ```

---

## 🚀 Quick Start

1. **Initialize**: Link your local project folder to an SRA Analysis.
   ```bash
   sra init
   ```
   *Follow the interactive prompts to authenticate and select your project.*

2. **Sync**: Download the latest requirements manifest (`sra.spec.json`).
   ```bash
   sra sync
   ```

3. **Review**: Interactively approve or reject AI-generated requirements (Human-in-the-Loop).
   ```bash
   sra review
   ```

4. **Verify**: Check which features are implemented and missing.
   ```bash
   sra check
   ```

5. **Push**: Sync your implementation progress back to the Platform.
   ```bash
   sra push
   ```

---

## 📖 Command Reference

### `sra init`
Connects your local environment to the SRA Platform. 
- Verifies your `SRA_API_KEY`.
- Fetches available projects from your account.
- Interactively lets you select which project to link.
- Creates `sra.config.json` and syncs the initial spec.

### `sra sync`
Pulls the finalized SRS from the cloud and converts it into a local `sra.spec.json` manifest. It intelligently merges with your existing local verification data, preserving your manual implementation links.

### `sra review`
**Human-in-the-Loop Verification.**
Interactive command to step through new AI-generated requirements.
- **Approve**: Mark a requirement as valid and ready for implementation.
- **Reject**: Flag a requirement as incorrect or unnecessary.
- **Comment**: Add feedback for the AI or team.

### `sra check`
Scans your local codebase based on the `verification_files` mapped in your `sra.spec.json`.
- **Verified**: Implementation files exist and are linked.
- **Pending**: Requirement is approved but not yet linked to code.
- **Failed**: Linked files are missing or deleted.

### `sra push`
Uploads your local verification statuses and file links back to the SRA Platform. This updates the live "Verified" badges on your project dashboard.

### `sra doctor`
Runs a suite of diagnostics to verify connectivity, environment variables, API key validity, and write permissions.

### `sra reverse` (Beta)
Analyzes local source code to help generate draft requirement skeletons. Useful for retrofitting SRA into existing legacy projects.

---

## 🏗️ Enterprise Architecture

Built with a modular, layered architecture for maximum reliability:
- **`src/api`**: Resilient API client with automatic retry logic and error interceptors.
- **`src/config`**: Centralized configuration management.
- **`src/utils`**: Professional logging with `ora` spinners and `chalk` themes.
- **`src/commands`**: Decoupled command logic for high testability.

---

## 📄 License

ISC © [SRA Team](https://github.com/Aniket-a14/SRA)
