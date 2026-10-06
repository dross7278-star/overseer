import type { ApprovalDecision, PendingApproval, StepLog, StepType, TaskSummary } from "../src/types";

type Guard<T> = (value: unknown) => value is T;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function request<T>(url: string, guard: Guard<T>, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const body = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error(body.trimStart().startsWith("<")
      ? "The API returned a webpage instead of JSON. Start the Node server and open the website through npm run dev or npm start, not a static-file server."
      : `The API returned invalid JSON (${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(isRecord(payload) && typeof payload.error === "string"
      ? payload.error : `Request failed (${response.status}).`);
  }
  if (!guard(payload)) throw new Error(`The API returned an unexpected response for ${url}.`);
  return payload;
}

const statuses = new Set(["running", "awaiting approval", "completed", "failed"]);
const stepTypes = new Set<StepType>([
  "started", "thought", "action_proposed", "pending_approval", "approved",
  "rejected", "observation", "retry", "error", "done",
]);

function isTask(value: unknown): value is TaskSummary {
  return isRecord(value) && typeof value.taskId === "string" &&
    typeof value.status === "string" && statuses.has(value.status) &&
    typeof value.latestEvent === "string" && typeof value.updatedAt === "string";
}

function isApproval(value: unknown): value is PendingApproval {
  return isRecord(value) && typeof value.taskId === "string" &&
    typeof value.step === "number" && Number.isInteger(value.step) &&
    typeof value.action === "string" && isRecord(value.params) && typeof value.reasoning === "string";
}

function isStepType(value: unknown): value is StepType {
  return typeof value === "string" && [...stepTypes].some(type => type === value);
}

function isStep(value: unknown): value is StepLog {
  return isRecord(value) && typeof value.taskId === "string" &&
    typeof value.step === "number" && isStepType(value.type) &&
    typeof value.content === "string" && typeof value.timestamp === "string";
}

function isHealth(value: unknown): value is { status: "ok"; service: "overseer" } {
  return isRecord(value) && value.status === "ok" && value.service === "overseer";
}

function isTasks(value: unknown): value is { tasks: TaskSummary[] } {
  return isRecord(value) && Array.isArray(value.tasks) && value.tasks.every(isTask);
}

function isApprovals(value: unknown): value is { approvals: PendingApproval[] } {
  return isRecord(value) && Array.isArray(value.approvals) && value.approvals.every(isApproval);
}

function isTrace(value: unknown): value is { trace: StepLog[] } {
  return isRecord(value) && Array.isArray(value.trace) && value.trace.every(isStep);
}

function isCreatedTask(value: unknown): value is { taskId: string } {
  return isRecord(value) && typeof value.taskId === "string" && value.taskId.length > 0;
}

function isDecision(value: unknown): value is { status: ApprovalDecision } {
  return isRecord(value) && (value.status === "approved" || value.status === "rejected");
}

export const api = {
  health: (signal: AbortSignal) => request("/api/health", isHealth, { signal }),
  tasks: (signal: AbortSignal) => request("/api/tasks", isTasks, { signal }),
  approvals: (signal: AbortSignal) => request("/api/approvals", isApprovals, { signal }),
  trace: (taskId: string, signal: AbortSignal) =>
    request(`/api/tasks/${encodeURIComponent(taskId)}/trace`, isTrace, { signal }),
  start: (goal: string) => request("/api/tasks", isCreatedTask, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ goal }),
  }),
  decide: (approval: PendingApproval, decision: ApprovalDecision) =>
    request(`/api/approvals/${encodeURIComponent(approval.taskId)}/${approval.step}`, isDecision, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision }),
    }),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
