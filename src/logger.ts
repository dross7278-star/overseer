import Database from "better-sqlite3";
import path from "node:path";
import { eventBus } from "./eventBus";
import type { StepLog, TaskSummary } from "./types";

export interface Logger {
  info(message: string): void;
  error(message: string, error?: unknown): void;
}

export const logger: Logger = {
  info(message) {
    console.info(message);
  },
  error(message, error) {
    console.error(message, error);
  },
};

interface StepRow {
  taskId: string;
  step: number;
  type: StepLog["type"];
  content: string;
  raw: string | null;
  latencyMs: number | null;
  timestamp: string;
}

interface TaskRow {
  taskId: string;
  type: StepLog["type"];
  content: string;
  timestamp: string;
}

interface PendingApprovalRow {
  taskId: string;
  step: number;
  raw: string | null;
}

export interface PendingApprovalSummary {
  taskId: string;
  step: number;
  action: string;
  params: Record<string, unknown>;
  reasoning: string;
}

const db = new Database(process.env.DATABASE_PATH || path.join(__dirname, "..", "overseer.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    taskId TEXT NOT NULL,
    step INTEGER NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    raw TEXT,
    latencyMs INTEGER,
    timestamp TEXT NOT NULL
  )
`);

const insertStmt = db.prepare(`
  INSERT INTO steps (taskId, step, type, content, raw, latencyMs, timestamp)
  VALUES (@taskId, @step, @type, @content, @raw, @latencyMs, @timestamp)
`);

export function logStep(log: StepLog): void {
  insertStmt.run({
    taskId: log.taskId,
    step: log.step,
    type: log.type,
    content: log.content,
    raw: serializeRaw(log.raw),
    latencyMs: log.latencyMs ?? null,
    timestamp: log.timestamp,
  });
  eventBus.publish(log.taskId, log);
}

export function getTrace(taskId: string): StepLog[] {
  const rows = db
    .prepare("SELECT * FROM steps WHERE taskId = ? ORDER BY id ASC")
    .all(taskId) as StepRow[];

  return rows.map((row) => ({
    taskId: row.taskId,
    step: row.step,
    type: row.type,
    content: row.content,
    raw: row.raw ? JSON.parse(row.raw) : undefined,
    latencyMs: row.latencyMs ?? undefined,
    timestamp: row.timestamp,
  }));
}

export function getRecentTasks(): TaskSummary[] {
  const rows = db
    .prepare(`
      SELECT taskId, type, content, timestamp
      FROM steps AS current
      WHERE id = (
        SELECT id FROM steps
        WHERE taskId = current.taskId
        ORDER BY id DESC
        LIMIT 1
      )
      ORDER BY id DESC
      LIMIT 20
    `)
    .all() as TaskRow[];

  return rows.map((row) => ({
    taskId: row.taskId,
    status: taskStatus(row.type),
    latestEvent: row.content,
    updatedAt: row.timestamp,
  }));
}

export function getPendingApprovals(): PendingApprovalSummary[] {
  const rows = db
    .prepare(`
      SELECT pending.taskId, pending.step, pending.raw
      FROM steps AS pending
      WHERE pending.type = 'pending_approval'
        AND NOT EXISTS (
          SELECT 1 FROM steps AS decision
          WHERE decision.taskId = pending.taskId
            AND decision.step = pending.step
            AND decision.type IN ('approved', 'rejected')
            AND decision.id > pending.id
        )
      ORDER BY pending.id DESC
    `)
    .all() as PendingApprovalRow[];

  return rows.map(({ taskId, step, raw }) => {
    if (!raw) {
      throw new Error(`Pending approval for task "${taskId}" has no details.`);
    }

    const details: unknown = JSON.parse(raw);
    if (!isApprovalDetails(details)) {
      throw new Error(`Pending approval for task "${taskId}" has invalid details.`);
    }

    return {
      taskId,
      step,
      action: details.action,
      params: details.params,
      reasoning: details.reasoning,
    };
  });
}

function serializeRaw(raw: unknown): string | null {
  if (raw === undefined) return null;
  const serialized = JSON.stringify(raw);
  if (serialized === undefined) {
    throw new TypeError("Step log raw data could not be serialized.");
  }
  return serialized;
}

function taskStatus(type: StepLog["type"]): string {
  switch (type) {
    case "started":
    case "thought":
    case "action_proposed":
    case "approved":
    case "observation":
    case "retry":
    case "rejected":
      return "running";
    case "pending_approval":
      return "awaiting approval";
    case "done":
      return "completed";
    case "error":
      return "failed";
  }
}

function isApprovalDetails(
  value: unknown,
): value is { action: string; params: Record<string, unknown>; reasoning: string } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const details = value as Record<string, unknown>;
  return (
    typeof details.action === "string" &&
    isRecord(details.params) &&
    typeof details.reasoning === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
