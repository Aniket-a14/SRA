# SRA CLI 🚀
[![Socket Badge](https://badge.socket.dev/npm/package/@sra-srs/sra-cli/4.0.1)](https://badge.socket.dev/npm/package/@sra-srs/sra-cli/4.0.1)
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
2. **Sync**: Download the latest requirements manifest (`sra.spec.json`).
   ```bash
   sra sync
   ```
3. **Verify**: Check which features are implemented and missing.
   ```bash
   sra check
   ```
4. **Push**: Sync your implementation progress back to the Platform.
   ```bash
   sra push
   ```

---

## 📖 Command Reference

### `sra init`
Connects your local environment to the SRA Platform. It verifies your API key and allows you to select a target project.
- Creates `sra.config.json`.

### `sra sync`
Pulls the finalized SRS from the cloud and converts it into a local `sra.spec.json` manifest. It intelligently merges with your existing local verification data.

### `sra check`
Scans your local codebase based on the `verification_files` mapped in your `sra.spec.json`.
- **Verified**: All implementation files exist.
- **Failed**: One or more implementation files are missing.
- **Pending**: No implementation files have been linked yet.

### `sra push`
Uploads your local verification statuses and file links back to the SRA Platform, updating the "Verified" badges on your dashboard.

### `sra doctor`
Runs a suite of diagnostics to verify connectivity, environment variables, and project configuration.

### `sra reverse` (Beta)
Analyzes local source code to help generate draft requirement skeletons.

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
