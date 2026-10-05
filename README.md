# Overseer

Overseer is a local web dashboard for running and observing a human-in-the-loop
AI agent. Submit a goal, follow the agent's activity trace, and review actions
that require approval before they continue.

## Features

- Submit agent goals from a browser dashboard.
- View recent runs and their recorded activity traces.
- Approve or reject actions marked as requiring human review.
- Persist run traces in a local SQLite database.
- Check server availability through a health endpoint.

## Requirements

- Node.js 22 or newer.
- npm.
- An OpenAI API key with API access and available usage.

ChatGPT subscriptions do not include OpenAI API usage credits. Check your API
account's billing and usage limits if a task reports an API quota or credits
error.

## Getting started

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create a local `.env` file from the example:

   **Windows PowerShell**

   ```powershell
   Copy-Item .env.example .env
   ```

   **macOS/Linux**

   ```sh
   cp .env.example .env
   ```

3. Edit `.env` and replace the example API key with your own key:

   ```dotenv
   OPENAI_API_KEY=your-openai-api-key
   PORT=3001
   ```

   Keep `.env` private. It is excluded from Git; do not commit or share your
   actual API key.

4. Start the development server:

   ```sh
   npm run dev
   ```

5. Open [http://localhost:3001](http://localhost:3001).

The server loads `.env` automatically. After changing environment variables,
stop and restart the server.

## Production build

```sh
npm run build
npm start
```

The server uses port `3001` by default. Set `PORT` in `.env` to use a different
port.

## API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Server health status |
| `GET` | `/api/tasks` | Recent agent runs |
| `POST` | `/api/tasks` | Start a run with a JSON body such as `{"goal":"Summarize three renewable energy initiatives"}` |
| `GET` | `/api/tasks/:taskId/trace` | Activity trace for a run |
| `GET` | `/api/approvals` | Actions currently awaiting approval |
| `POST` | `/api/approvals/:taskId/:step` | Submit `{"decision":"approved"}` or `{"decision":"rejected"}` |

## Current limitations

- The agent uses the OpenAI `gpt-4o-mini` model and requires a working API key.
- The `web_search` tool currently returns placeholder results; it is not
  connected to a live search provider.
- Email drafts are held in memory and email sending is simulated. No email is
  sent.
- Approval requests are held in memory while the server is running. Run traces
  are stored in the local `overseer.db` SQLite database.
- This is a local development application. It does not include user
  authentication or production deployment hardening.

## Project structure

```text
src/
  agentLoop.ts       Agent orchestration
  approvalManager.ts Human approval handling
  eventBus.ts        In-process task events
  llmClient.ts       OpenAI client and response validation
  logger.ts          Console logging and SQLite traces
  server.ts          HTTP server and API routes
  systemPrompt.ts    Agent instructions
  tools.ts           Tool definitions and execution
  types.ts           Shared TypeScript types
index.html           Dashboard UI
```