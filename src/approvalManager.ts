import type { ApprovalDecision } from "./types";

interface PendingEntry {
  resolve: (decision: ApprovalDecision) => void;
}

class ApprovalManager {
  private readonly pending = new Map<string, PendingEntry>();

  private key(taskId: string, step: number): string {
    return `${taskId}:${step}`;
  }

  waitForApproval(taskId: string, step: number): Promise<ApprovalDecision> {
    const key = this.key(taskId, step);
    if (this.pending.has(key)) {
      return Promise.reject(
        new Error(`Approval is already pending for task "${taskId}", step ${step}.`),
      );
    }

    return new Promise((resolve) => {
      this.pending.set(key, { resolve });
    });
  }

  submitDecision(
    taskId: string,
    step: number,
    decision: ApprovalDecision,
  ): boolean {
    const key = this.key(taskId, step);
    const entry = this.pending.get(key);
    if (!entry) return false;

    this.pending.delete(key);
    entry.resolve(decision);
    return true;
  }

  isPending(taskId: string, step: number): boolean {
    return this.pending.has(this.key(taskId, step));
  }
}

export const approvalManager = new ApprovalManager();
