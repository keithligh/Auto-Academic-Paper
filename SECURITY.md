# Security Policy

## Supported Versions

Use the latest version of the repository main branch.

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| < 1.0   | :x:                |

## Architecture & Data Safety ("The Code is Law")

We take a "Local-First" and "Fail-Safe" approach to security.

### 1. API Key Security
- **Client-Side Storage**: API keys are stored **exclusively** in your browser's `localStorage`. They are never saved to a database or disk on the server.
- **Transmission**: Keys are transmitted via encrypted headers (`Authorization` or `X-Poe-Api-Key`) directly to the AI provider (via the local proxy). 
- **No Logging**: The server is designed to act as a stateless pass-through for authentication. Keys are not logged.

### 2. Input/Output Sanitization
- **Strict Schemas**: We use Zod schemas to narrowly define and validate all inputs (e.g., file types, JSON structures).
- **Sanitization Pipelines**:
    - **LaTeX Injection**: All AI output passes through `sanitizeLatexOutput()` to strip potential command injections or leaked formatting.
    - **Export Safety**: Before download, files are processed by `sanitizeLatexForExport()` to ensure compilation safety.

### 3. Server Isolation
- **Local Environment**: The application is designed to run locally or in an isolated container.
- **Ephemeral Storage**: Uploaded documents are processed in temporary directories and validated for MIME types (`application/pdf`, `text/plain`).

## Reporting a Vulnerability

Please open a **GitHub Issue** with the label `security`.

### Reporting Process
1. Open a new issue.
2. Describe the vulnerability in detail.
3. Provide steps to reproduce.
4. We will review it within the standard open-source contribution cycle.
