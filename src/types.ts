export type Role = "system" | "user" | "assistant";

export interface Message {
  role: Role;
  content: string;
}

export interface AgentDecision {
  reasoning: string;
  action: string;
  params: Record<string, unknown>;
  confidence?: number;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export type StepType =
  | "started"
  | "thought"
  | "action_proposed"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "observation"
  | "retry"
  | "error"
  | "done";

export interface StepLog {
  taskId: string;
  step: number;
  type: StepType;
  content: string;
  raw?: unknown;
  latencyMs?: number;
  timestamp: string;
}

export type ApprovalDecision = "approved" | "rejected";

export interface PendingApproval {
  taskId: string;
  step: number;
  action: string;
  params: Record<string, unknown>;
  reasoning: string;
}

export interface TaskSummary {
  taskId: string;
  status: string;
  latestEvent: string;
  updatedAt: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface AgentEvent<T = unknown> {
  type: string;
  payload: T;
  timestamp: Date;
}
