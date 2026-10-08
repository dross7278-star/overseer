# Overseer

Overseer is a React + TypeScript website with a Node.js backend for running and observing a human-in-the-loop
AI agent. Submit a goal, follow the agent's activity trace, and review actions
that require approval before they continue.

## Features

- Submit agent goals from a browser dashboard.
- View recent runs and their recorded activity traces.
- Approve or reject actions marked as requiring human review.
- Persist run traces in a local SQLite database.
- Check server availability through a health endpoint.
- Explore a responsive homepage with features, a workflow overview, and FAQs.

## Requirements

- Node.js 22.12 or newer (tested locally with Node.js 24).
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

5. Open [http://localhost:5173](http://localhost:5173).

The homepage is served at `/`. Choose **Open dashboard**, or go directly to
[http://localhost:5173/dashboard](http://localhost:5173/dashboard), to use the
agent control panel. In development, Vite serves React on port `5173` and
proxies `/api` to the Node server at `PORT` (default `3001`). The development
command starts both servers and supports frontend hot reload. Do not use a
static-file server. This website is local; it has not been deployed publicly.

The server loads `.env` automatically. After changing environment variables,
stop and restart the server.

## Deploy a public website with Render

Render can host the entire website and API together. The included `render.yaml`
creates a free, public, read-only Node web service: visitors can view the
homepage, dashboard, runs, and traces, but cannot start runs or approve actions.
No OpenAI API key is needed.

1. Push the contents of this project directory to a GitHub repository.
   Do not upload `.env`, `node_modules`, `dist`, or SQLite databases.
2. Sign in to [Render](https://dashboard.render.com/), select **New > Blueprint**,
   and connect that repository. If the project is in a subdirectory, provide
   the path to its `render.yaml` and set the service's **Root Directory** to
   that project directory.
3. Review the Blueprint and deploy it. It sets Node.js `24.18.0`,
   `NODE_ENV=production`, `PUBLIC_READ_ONLY=true`, and
   `VITE_PUBLIC_READ_ONLY=true`.
4. Once Render reports the service as live, open its assigned
   `https://<service-name>.onrender.com` URL. Verify the homepage,
   `/dashboard`, and `/api/health` (which should report `"status":"ok"`).
   The dashboard should show read-only controls.

For a manually created **Web Service**, select the **Node** runtime and
**Free** instance type. Use `npm ci --include=dev && npm run build` as the
build command, `npm start` as the start command, and `/api/health` as the
health check path. Add all four environment variables listed above before
the initial build, and leave `DATABASE_PATH` unset. TypeScript and Vite are
build dependencies, so the explicit `--include=dev` is necessary.

Render supplies HTTPS. To use a custom domain, add it in the Render service's
settings and follow its DNS instructions. Free services may sleep when idle,
so the first request can be slow. Their SQLite history is not durable across
restarts or deployments. The existing local database is not uploaded, so a new
deployment starts with empty history. History on this instance is public;
do not store sensitive goals or data.

## Optional: Vercel frontend with Render API

The website can be hosted on Vercel while the Node.js API and SQLite history
run on Render. Vercel provides HTTPS for the public website and proxies its
API requests to the Render service. Public deployments use read-only mode:
visitors can view runs and traces, but cannot start runs or approve actions.

1. Push this project to a GitHub repository.
2. Create a Render Blueprint from the repository using `render.yaml`. It uses
   the Free Node service without a disk. History can disappear on restarts or
   deploys. No OpenAI key is needed for this read-only deployment.
   For a manually created service, select the Node runtime, set the build
   command to `npm ci --include=dev && npm run build`, and the start command to
   `npm start`. Set `NODE_ENV=production` and `PUBLIC_READ_ONLY=true`; leave
   `DATABASE_PATH` unset. The explicit `--include=dev` installs TypeScript and
   type definitions needed for the build even in a production environment.
3. Create a Vercel project from the same repository. Set the project root to
   this project directory, if needed. Set `OVERSEER_API_URL` to the Render
   service base URL (for example, `https://overseer.example.onrender.com`).
   Set `VITE_PUBLIC_READ_ONLY` to `true` for the Production environment so the
   dashboard UI also disables its controls.
4. Deploy on Vercel. The `vercel.json` config builds the Vite website and
   routes `/dashboard` to the app. Vercel supplies HTTPS automatically.
5. To use a custom domain, add it to the Vercel project and complete the DNS
   instructions in Vercel.

The Vercel site is public, and run history is therefore public as well. Do not
store sensitive goals or data in this instance. The Render API independently
enforces read-only mode, so visitors cannot invoke paid model runs even if
they bypass the Vercel interface. The Render Blueprint uses a free web service without
persistent storage. It may sleep when idle, and history is not durable.
Set `PUBLIC_READ_ONLY=false` only if you
intentionally want to restore write access; production then requires both
`DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD`.

## Production build

```sh
npm run build
npm start
```

The production build type-checks both applications, compiles the Node backend,
and bundles React into `dist/client`. With `npm start`, Node serves the homepage,
dashboard, frontend assets, and API at [http://localhost:3001](http://localhost:3001).
Set `PORT` in `.env` to use a different port. Run `npm run build` before the first
production start and after frontend source changes.

Run `npm run typecheck` to check the frontend and backend without generating a
build. Run `npm test` for the typed API client's response validation, request,
error-handling, and cancellation tests (Node's built-in test runner).
Only variables prefixed with `VITE_` are eligible for frontend exposure;
never place secrets in such variables. Keep `OPENAI_API_KEY` server-side.

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
- Local development has no authentication unless `DASHBOARD_USERNAME` and
  `DASHBOARD_PASSWORD` are set. Production requires those credentials unless
  `PUBLIC_READ_ONLY=true`; this is shared Basic Authentication, not individual
  user accounts.
- The public Vercel/Render deployment exposes run history to everyone. It does
  not include individual accounts or a full production security review.

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
api/
  [...path].ts       Vercel proxy to the Render API
client/
  components/        Shared React layout components
  hooks/             Workspace polling and request cleanup
  pages/             Homepage and agent dashboard
  api.ts             Typed API requests and response validation
  main.tsx           React application entry point
  styles.css         Responsive website and dashboard styling
index.html           Vite HTML entry
vite.config.ts       Frontend build and development API proxy
tsconfig.client.json Frontend TypeScript configuration
render.yaml          Render website/API service (free, read-only, no disk)
vercel.json          Vercel static site, API function, and dashboard route
```
