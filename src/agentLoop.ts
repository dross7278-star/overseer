import { v4 as uuidv4 } from "uuid";
import { approvalManager } from "./approvalManager";
import { callLLM } from "./llmClient";
import { logStep } from "./logger";
import { SYSTEM_PROMPT } from "./systemPrompt";
import { executeTool, REQUIRES_APPROVAL } from "./tools";
import type { Message, StepLog, StepType, ToolResult } from "./types";

const MAX_STEPS = 10;
const MAX_RETRIES = 3;

export async function runAgentLoop(
  goal: string,
  taskId: string,
): Promise<void> {
  const context: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: goal },
  ];

  for (let step = 1; step <= MAX_STEPS; step++) {
    const start = Date.now();

    let decision;
    try {
      decision = await callLLM(context);
    } catch (error) {
      emit(
        taskId,
        step,
        "error",
        `LLM call failed: ${errorMessage(error)}`,
        Date.now() - start,
      );
      return;
    }

    emit(
      taskId,
      step,
      "thought",
      decision.reasoning,
      Date.now() - start,
      { confidence: decision.confidence, action: decision.action },
    );

    if (decision.action === "done") {
      emit(taskId, step, "done", "Agent reported task complete.");
      return;
    }

    emit(
      taskId,
      step,
      "action_proposed",
      `Proposed: ${decision.action}`,
      undefined,
      { params: decision.params },
    );

    if (REQUIRES_APPROVAL.has(decision.action)) {
      emit(
        taskId,
        step,
        "pending_approval",
        `Waiting for human approval: ${decision.action}`,
        undefined,
        {
          action: decision.action,
          params: decision.params,
          reasoning: decision.reasoning,
        },
      );

      let approvalDecision;
      try {
        approvalDecision = await approvalManager.waitForApproval(taskId, step);
      } catch (error) {
        emit(
          taskId,
          step,
          "error",
          `Approval wait failed: ${errorMessage(error)}`,
        );
        return;
      }

      if (approvalDecision === "rejected") {
        emit(taskId, step, "rejected", `Human rejected: ${decision.action}`);
        context.push({ role: "assistant", content: JSON.stringify(decision) });
        context.push({
          role: "user",
          content:
            "Observation: Action rejected by human reviewer. Choose a different approach.",
        });
        continue;
      }

      emit(taskId, step, "approved", `Human approved: ${decision.action}`);
    }

    const result = await executeWithRetry(
      decision.action,
      decision.params,
      taskId,
      step,
    );

    context.push({ role: "assistant", content: JSON.stringify(decision) });
    context.push({
      role: "user",
      content: `Observation: ${JSON.stringify(result)}`,
    });

    emit(
      taskId,
      step,
      "observation",
      summarizeResult(result),
      undefined,
      result,
    );

    if (!result.success) {
      emit(taskId, step, "error", `Tool failed after retries: ${result.error}`);
    }
  }

  emit(taskId, MAX_STEPS, "error", "Max steps reached without completion.");
}

async function executeWithRetry(
  action: string,
  params: Record<string, unknown>,
  taskId: string,
  step: number,
): Promise<ToolResult> {
  let lastResult: ToolResult = {
    success: false,
    error: "Tool execution did not run.",
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      lastResult = await executeTool(action, params);
    } catch (error) {
      lastResult = { success: false, error: errorMessage(error) };
    }

    if (lastResult.success) return lastResult;

    if (attempt < MAX_RETRIES) {
      const backoffMs = 200 * 2 ** (attempt - 1);
      emit(
        taskId,
        step,
        "retry",
        `Attempt ${attempt} failed (${lastResult.error}). Retrying in ${backoffMs}ms.`,
      );
      await delay(backoffMs);
    }
  }

  return lastResult;
}

function summarizeResult(result: ToolResult): string {
  if (result.success) {
    return `Success: ${JSON.stringify(result.data).slice(0, 200)}`;
  }
  return `Failed: ${result.error}`;
}

function emit(
  taskId: string,
  step: number,
  type: StepType,
  content: string,
  latencyMs?: number,
  raw?: unknown,
): void {
  const log: StepLog = {
    taskId,
    step,
    type,
    content,
    raw,
    latencyMs,
    timestamp: new Date().toISOString(),
  };
  logStep(log);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function newTaskId(): string {
  return uuidv4();
}
