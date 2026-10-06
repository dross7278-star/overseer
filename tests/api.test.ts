import assert from "node:assert/strict";
import { test } from "node:test";
import { api } from "../client/api.ts";
import { getDashboardCredentials, isAuthorized } from "../src/auth.ts";

test("requires complete dashboard credentials in production", () => {
  assert.throws(
    () => getDashboardCredentials({ NODE_ENV: "production" }),
    /required in production/,
  );
  assert.throws(
    () => getDashboardCredentials({ DASHBOARD_USERNAME: "operator" }),
    /Set both/,
  );
  assert.equal(getDashboardCredentials({ NODE_ENV: "development" }), undefined);
  assert.equal(
    getDashboardCredentials({ NODE_ENV: "development", DASHBOARD_USERNAME: "", DASHBOARD_PASSWORD: "" }),
    undefined,
  );
  assert.equal(
    getDashboardCredentials({ NODE_ENV: "production", PUBLIC_READ_ONLY: "true" }),
    undefined,
  );
});

test("authorizes only matching HTTP Basic credentials", () => {
  const credentials = { username: "operator", password: "a strong password" };
  const valid = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64")}`;
  assert.equal(isAuthorized(valid, credentials), true);
  assert.equal(isAuthorized(undefined, credentials), false);
  assert.equal(isAuthorized("Bearer token", credentials), false);
  assert.equal(
    isAuthorized(`Basic ${Buffer.from("operator:wrong").toString("base64")}`, credentials),
    false,
  );
});

test("accepts valid workspace responses", async (context) => {
  const payloads = [
    { status: "ok", service: "overseer" },
    { tasks: [{ taskId: "task-1", status: "running", latestEvent: "Started", updatedAt: "2026-10-05T00:00:00Z" }] },
    { approvals: [{ taskId: "task-1", step: 2, action: "send_email", params: { draftId: "draft_1" }, reasoning: "Review before sending." }] },
    { trace: [{ taskId: "task-1", step: 1, type: "thought", content: "Prepare a draft.", timestamp: "2026-10-05T00:00:00Z" }] },
  ];
  context.mock.method(globalThis, "fetch", async () => Response.json(payloads.shift()));
  const signal = new AbortController().signal;
  assert.equal((await api.health(signal)).status, "ok");
  assert.equal((await api.tasks(signal)).tasks[0].taskId, "task-1");
  assert.equal((await api.approvals(signal)).approvals[0].action, "send_email");
  assert.equal((await api.trace("task-1", signal)).trace[0].type, "thought");
});

test("reports HTML from a wrong server with an actionable error", async (context) => {
  context.mock.method(globalThis, "fetch", async () => new Response("<!DOCTYPE html><title>Wrong server</title>"));
  await assert.rejects(api.health(new AbortController().signal), /webpage instead of JSON/);
});

test("surfaces API failures instead of returning success", async (context) => {
  context.mock.method(globalThis, "fetch", async () => Response.json({ error: "This approval is no longer pending." }, { status: 409 }));
  await assert.rejects(api.decide({
    taskId: "task-1", step: 2, action: "send_email", params: {}, reasoning: "Review",
  }, "approved"), /no longer pending/);
});

test("rejects malformed successful responses", async (context) => {
  context.mock.method(globalThis, "fetch", async () => Response.json({ tasks: [{ taskId: "task-1" }] }));
  await assert.rejects(api.tasks(new AbortController().signal), /unexpected response/);
});

test("reports invalid JSON without an opaque parsing error", async (context) => {
  context.mock.method(globalThis, "fetch", async () => new Response("not JSON"));
  await assert.rejects(api.health(new AbortController().signal), /invalid JSON/);
});

test("sends task goals as JSON", async (context) => {
  context.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(url, "/api/tasks");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(String(options.body)), { goal: "Prepare a summary" });
    return Response.json({ taskId: "new-task" }, { status: 202 });
  });
  assert.deepEqual(await api.start("Prepare a summary"), { taskId: "new-task" });
});

test("encodes approval identifiers and submits the decision", async (context) => {
  context.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(url, "/api/approvals/task%2Fone/2");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(String(options.body)), { decision: "rejected" });
    return Response.json({ status: "rejected" });
  });
  assert.deepEqual(await api.decide({
    taskId: "task/one", step: 2, action: "send_email", params: {}, reasoning: "Review",
  }, "rejected"), { status: "rejected" });
});

test("forwards cancellation to workspace requests", async (context) => {
  const controller = new AbortController();
  context.mock.method(globalThis, "fetch", async (_url: string, options: RequestInit) => {
    assert.equal(options.signal, controller.signal);
    return Response.json({ tasks: [] });
  });
  await api.tasks(controller.signal);
});
