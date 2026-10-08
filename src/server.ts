import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDashboardCredentials, isAuthorized } from "./auth";
import { approvalManager } from "./approvalManager";
import { runAgentLoop, newTaskId } from "./agentLoop";
import { getPendingApprovals, getRecentTasks, getTrace, logStep, logger } from "./logger";
import type { ApprovalDecision } from "./types";

const port = Number(process.env.PORT ?? 3001);
const clientDirectory = path.join(__dirname, "..", "dist", "client");
const publicReadOnly = process.env.PUBLIC_READ_ONLY === "true";
const dashboardCredentials = getDashboardCredentials();

const server = createServer(async (request, response) => {
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("x-frame-options", "DENY");
  response.setHeader("referrer-policy", "same-origin");
  if (process.env.NODE_ENV === "production") {
    response.setHeader("strict-transport-security", "max-age=31536000");
  }
  try {
    await routeRequest(request, response);
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(response, error.status, { error: error.message });
      return;
    }
    logger.error("Request failed.", error);
    sendJson(response, 500, { error: "Internal server error." });
  }
});

server.listen(port, () => {
  logger.info(`Overseer listening on port ${port}`);
});

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const isPublicReadEndpoint =
    request.method === "GET" &&
    (url.pathname === "/api/health" ||
      url.pathname === "/api/tasks" ||
      url.pathname === "/api/approvals" ||
      /^\/api\/tasks\/[^/]+\/trace$/.test(url.pathname));

  if (publicReadOnly && url.pathname.startsWith("/api/") && !isPublicReadEndpoint) {
    sendJson(response, 403, { error: "This deployment is read-only." });
    return;
  }

  const requiresAuthentication = !publicReadOnly && (
    url.pathname === "/dashboard" ||
    url.pathname === "/dashboard/" ||
    (url.pathname.startsWith("/api/") && url.pathname !== "/api/health")
  );

  if (
    requiresAuthentication &&
    (!dashboardCredentials || !isAuthorized(request.headers.authorization, dashboardCredentials))
  ) {
    response.writeHead(401, {
      "content-type": "text/plain; charset=utf-8",
      "www-authenticate": 'Basic realm="Overseer", charset="UTF-8"',
      "cache-control": "no-store",
    });
    response.end("Authentication required.");
    return;
  }

  if (
    request.method === "GET" &&
    (url.pathname === "/" || url.pathname === "/dashboard" || url.pathname === "/dashboard/")
  ) {
    const html = await readFile(path.join(clientDirectory, "index.html"));
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/assets/")) {
    const assetName = url.pathname.slice("/assets/".length);
    if (!/^[a-zA-Z0-9_-]+\.(js|css)$/.test(assetName)) {
      sendJson(response, 404, { error: "Not found." });
      return;
    }
    let asset: Buffer;
    try {
      asset = await readFile(path.join(clientDirectory, "assets", assetName));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        sendJson(response, 404, { error: "Asset not found." });
        return;
      }
      throw error;
    }
    response.writeHead(200, {
      "content-type": assetName.endsWith(".css")
        ? "text/css; charset=utf-8"
        : "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
    });
    response.end(asset);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { status: "ok", service: "overseer" });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/tasks") {
    sendJson(response, 200, { tasks: getRecentTasks() });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/approvals") {
    const approvals = getPendingApprovals().filter(({ taskId, step }) =>
      approvalManager.isPending(taskId, step),
    );
    sendJson(response, 200, { approvals });
    return;
  }

  const traceMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/trace$/);
  if (request.method === "GET" && traceMatch) {
    sendJson(response, 200, { trace: getTrace(decodeURIComponent(traceMatch[1])) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tasks") {
    const body = await readJsonBody(request);
    const goal = isRecord(body) && typeof body.goal === "string" ? body.goal.trim() : "";
    if (!goal) {
      sendJson(response, 400, { error: "A non-empty goal is required." });
      return;
    }
    if (goal.length > 10_000) {
      sendJson(response, 413, { error: "Goal must be 10,000 characters or fewer." });
      return;
    }

    const taskId = newTaskId();
    logStep({
      taskId,
      step: 0,
      type: "started",
      content: goal,
      timestamp: new Date().toISOString(),
    });
    sendJson(response, 202, { taskId });
    void runAgentLoop(goal, taskId).catch((error: unknown) => {
      logger.error(`Task "${taskId}" failed unexpectedly.`, error);
      logStep({
        taskId,
        step: 0,
        type: "error",
        content: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    });
    return;
  }

  const approvalMatch = url.pathname.match(/^\/api\/approvals\/([^/]+)\/(\d+)$/);
  if (request.method === "POST" && approvalMatch) {
    const body = await readJsonBody(request);
    const decision: ApprovalDecision | undefined =
      isRecord(body) && (body.decision === "approved" || body.decision === "rejected")
        ? body.decision
        : undefined;
    if (!decision) {
      sendJson(response, 400, { error: 'Decision must be "approved" or "rejected".' });
      return;
    }

    const taskId = decodeURIComponent(approvalMatch[1]);
    const step = Number(approvalMatch[2]);
    if (!approvalManager.submitDecision(taskId, step, decision)) {
      sendJson(response, 409, { error: "This approval is no longer pending." });
      return;
    }
    sendJson(response, 200, { status: decision });
    return;
  }

  sendJson(response, 404, { error: "Not found." });
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 16_384) {
      throw new HttpError(413, "Request body exceeds the 16 KB limit.");
    }
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
