import { useEffect, useState } from "react";
import type { PendingApproval, StepLog, TaskSummary } from "../../src/types";
import { api, errorMessage } from "../api";

export function useWorkspace(selectedTask: string | null, refreshVersion: number) {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [trace, setTrace] = useState<{ taskId: string; steps: StepLog[] } | null>(null);
  const [connection, setConnection] = useState<"connecting" | "connected" | "unavailable">("connecting");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      try {
        const [, taskData, approvalData, traceData] = await Promise.all([
          api.health(controller.signal), api.tasks(controller.signal), api.approvals(controller.signal),
          selectedTask ? api.trace(selectedTask, controller.signal) : Promise.resolve(null),
        ]);
        if (controller.signal.aborted) return;
        setTasks(taskData.tasks);
        setApprovals(approvalData.approvals);
        setTrace(selectedTask && traceData ? { taskId: selectedTask, steps: traceData.trace } : null);
        setConnection("connected");
        setError("");
      } catch (error) {
        if (controller.signal.aborted) return;
        setConnection("unavailable");
        setError(errorMessage(error));
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 3000);
      }
    }
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [selectedTask, refreshVersion]);

  return {
    tasks, approvals, connection, error,
    trace: trace?.taskId === selectedTask ? trace.steps : null,
  };
}
