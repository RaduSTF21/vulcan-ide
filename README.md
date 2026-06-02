# Vulcan IDE

Vulcan IDE is a browser-based smart contract security workspace built with Next.js.  
It combines a Monaco-powered editor, a virtual file system, AI-generated Foundry tests, Dockerized test execution, and streamed audit feedback in a single UI.

## What it does

- Edit contract and support files directly in the browser
- Organize files/folders in a virtual project tree (drag/drop included)
- Upload Solidity contracts for analysis
- Generate security-focused Foundry tests with Gemini
- Run tests in a Foundry Docker container
- Stream terminal output and AI audit feedback back to the UI
- Re-run analysis using previously generated tests

## Tech stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **UI:** Tailwind CSS, Monaco Editor, `react-resizable-panels`
- **State:** Zustand (persisted virtual file system)
- **AI:** `@google/genai` (Gemini models)
- **Execution:** Foundry in Docker (`ghcr.io/foundry-rs/foundry:latest`)

## Repository structure

```text
src/
  app/
    api/verify/route.ts      # AI generation + Foundry execution pipeline
    page.tsx                 # Main IDE screen
  components/
    AppLayout.tsx            # Resizable shell + sidebar toggle
    Sidebar.tsx              # Virtual file tree and file/folder actions
    Editor.tsx               # Monaco editor binding
  store/
    useVFSStore.ts           # Zustand virtual file system store
  types/
    vfs.ts                   # Virtual file model
```

## Prerequisites

- Node.js 20+ and npm
- Docker (running locally)
- Gemini API keys
- A local Foundry template directory expected at:
  - `vulcan-template/` in the repository root
  - used by `/src/app/api/verify/route.ts` during project setup

## Environment variables

Create a `.env.local` file in the project root:

```bash
GEMINI_API_KEY_1=your_key_here
GEMINI_API_KEY_2=optional_fallback_key
GEMINI_API_KEY_3=optional_fallback_key
GEMINI_API_KEY_4=optional_fallback_key
```

At least one key is required; additional keys are used as automatic fallbacks if a request fails.

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## How to use Vulcan IDE

1. Open the app and create/upload a Solidity file (`.sol`).
2. Click **Open Vulcan AI 🛡️**.
3. Set the number of tests to generate.
4. Click **Analyze Contract**.
5. Review:
   - generated tests (`GeneratedTests.t.sol`)
   - foundry output report
   - generated audit report (`AuditReport.md`)
6. Optionally click **Rerun with Generated Tests**.

## Available scripts

- `npm run dev` – start development server
- `npm run build` – build production bundle
- `npm run start` – run production server
- `npm run lint` – run ESLint

## Notes

- The `/api/verify` endpoint is `force-dynamic` and streams NDJSON updates.
- Temporary Foundry workspaces are created under `~/.vulcan-temp` and old folders are cleaned up automatically.
- Test execution depends on Docker volume access to the generated temp workspace and local `~/.svm`.
