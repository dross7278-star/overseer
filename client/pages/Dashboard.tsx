import { useRef, useState, type FormEvent } from "react";
import type { ApprovalDecision, PendingApproval } from "../../src/types";
import { api, errorMessage } from "../api";
import { publicReadOnly } from "../config";
import { EmptyState, Footer, Header } from "../components/Layout";
import { useWorkspace } from "../hooks/useWorkspace";

export function Dashboard() {
  const [goal, setGoal] = useState("");
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [decisionPending, setDecisionPending] = useState(false);
  const [actionError, setActionError] = useState("");
  const submitLock = useRef(false);
  const decisionLock = useRef(false);
  const workspace = useWorkspace(selectedTask, refreshVersion);
  const canAct = workspace.connection === "connected" && !publicReadOnly;

  async function startTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedGoal = goal.trim();
    if (submitLock.current || !canAct) return;
    if (!trimmedGoal) {
      setActionError("Please enter a non-empty goal.");
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    setActionError("");
    try {
      const result = await api.start(trimmedGoal);
      setSelectedTask(result.taskId);
      setGoal("");
      setRefreshVersion(version => version + 1);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  async function decide(approval: PendingApproval, decision: ApprovalDecision) {
    if (decisionLock.current || !canAct) return;
    decisionLock.current = true;
    setDecisionPending(true);
    setActionError("");
    try {
      await api.decide(approval, decision);
      setRefreshVersion(version => version + 1);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      decisionLock.current = false;
      setDecisionPending(false);
    }
  }

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header dashboard>
        <span className="connection" role="status">
          <span className={`connection-dot ${workspace.connection === "connected" ? "online" : ""}`} aria-hidden="true" />
          {workspace.connection === "connecting" ? "Connecting..." : workspace.connection === "connected" ? "Server connected" : "Server unavailable"}
        </span>
      </Header>
      <main className="wrap dashboard" id="main">
        <div className="page-intro"><p className="eyebrow">Your workspace</p><h1>Agent control center</h1><p>Give direction. Follow every step. Keep the decisions that matter in your hands.</p></div>
        <p className="demo-note"><strong>Prototype workspace.</strong> Search results are placeholders and email sending is simulated. Public deployments expose run history to everyone.</p>
        {publicReadOnly && <p className="demo-note" role="status"><strong>Public read-only view.</strong> Runs and approvals are disabled.</p>}
        {workspace.error && <div className="notice" role="alert">{workspace.error} Displayed history may be out of date; reconnecting automatically.</div>}
        {actionError && <div className="notice" role="alert">{actionError}</div>}
        <div className="workspace-layout">
          <div className="workspace-column">
            <section className="panel" aria-labelledby="new-run-title">
              <div className="panel-head"><div><p className="eyebrow">New run</p><h2 id="new-run-title">Give your agent a goal</h2></div></div>
              <form className="panel-body" onSubmit={startTask}>
                <label className="eyebrow goal-label" htmlFor="goal">Task goal</label>
                <textarea id="goal" className="goal" maxLength={10000} required value={goal}
                  onChange={event => setGoal(event.target.value)}
                  placeholder="e.g. Research renewable energy and summarize three key findings."
                  aria-describedby="goal-hint" />
                <div className="form-row"><p className="hint" id="goal-hint">Actions that need human approval will pause here.</p><button className="button" disabled={submitting || !canAct} type="submit">{submitting ? "Starting run..." : "Start agent run"} <span aria-hidden="true">&rarr;</span></button></div>
              </form>
            </section>
            <section className="panel" aria-labelledby="runs-title">
              <div className="panel-head"><h2 id="runs-title">Recent runs</h2><span className="muted-count">{workspace.tasks.length} {workspace.tasks.length === 1 ? "run" : "runs"}</span></div>
              {!workspace.tasks.length ? <EmptyState>{workspace.connection === "connecting" ? "Loading run history..." : publicReadOnly ? "No runs have been recorded in this public read-only deployment." : "No runs yet. Start a task to see agent activity here."}</EmptyState> :
                workspace.tasks.map(task => (
                  <button key={task.taskId} type="button" className={`task ${selectedTask === task.taskId ? "selected" : ""}`}
                    aria-pressed={selectedTask === task.taskId} onClick={() => setSelectedTask(task.taskId)}>
                    <span className="task-top"><span className="task-id">{task.taskId}</span><span className={`badge ${task.status.replaceAll(" ", "-")}`}>{task.status}</span></span>
                    <span className="task-latest">{task.latestEvent}</span>
                  </button>
                ))}
            </section>
            <section className="panel" aria-labelledby="trace-title">
              <div className="panel-head"><h2 id="trace-title">Activity trace</h2><span className="muted-count">{workspace.trace ? `${workspace.trace.length} events` : selectedTask ? "Loading trace..." : "Select a run"}</span></div>
              <div className="trace">
                {!selectedTask ? <EmptyState>Select a run to inspect its steps.</EmptyState> :
                  !workspace.trace ? <EmptyState>{workspace.error ? "Trace is unavailable. Waiting for the server to reconnect." : "Loading activity..."}</EmptyState> :
                    !workspace.trace.length ? <EmptyState>No activity has been recorded for this run.</EmptyState> :
                      [...workspace.trace].reverse().map((step, index) => (
                        <div className="trace-item" key={`${step.timestamp}-${index}`}>
                          <div className="trace-meta"><strong>{step.type.replaceAll("_", " ")}</strong><time dateTime={step.timestamp}>{new Date(step.timestamp).toLocaleTimeString()}</time></div>
                          <p className="trace-content">{step.content}</p>
                        </div>
                      ))}
              </div>
            </section>
          </div>
          <aside className="panel" aria-labelledby="approvals-title">
            <div className="panel-head"><h2 id="approvals-title">Needs your approval</h2><span className="muted-count">{workspace.approvals.length}</span></div>
            {!workspace.approvals.length ? <EmptyState>{workspace.connection === "connecting" ? "Loading approvals..." : "No actions are waiting for approval."}</EmptyState> :
              workspace.approvals.map(approval => (
                <div className="approval" key={`${approval.taskId}:${approval.step}`}>
                  <h3>{approval.action} &middot; step {approval.step}</h3>
                  <p className="approval-task">{approval.taskId}</p>
                  <p className="approval-reason">{approval.reasoning}</p>
                  <pre>{JSON.stringify(approval.params, null, 2)}</pre>
                  <div className="approval-actions">
                    <button className="reject" type="button" disabled={decisionPending || !canAct} onClick={() => void decide(approval, "rejected")}>Reject</button>
                    <button className="approve" type="button" disabled={decisionPending || !canAct} onClick={() => void decide(approval, "approved")}>Approve</button>
                  </div>
                </div>
              ))}
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
