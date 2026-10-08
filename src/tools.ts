import type { ToolCall, ToolResult } from "./types";

export const TOOL_SCHEMAS = {
  web_search: {
    name: "web_search",
    description: "Search the web for information relevant to the research goal",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" },
      },
      required: ["query"],
    },
  },
  draft_email: {
    name: "draft_email",
    description: "Create a draft email (safe, reversible, no approval needed)",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["to", "subject", "body"],
    },
  },
  send_email: {
    name: "send_email",
    description: "Send a previously drafted email. IRREVERSIBLE.",
    parameters: {
      type: "object",
      properties: {
        draftId: { type: "string" },
      },
      required: ["draftId"],
    },
  },
} as const;

export const REQUIRES_APPROVAL = new Set(["send_email"]);

const drafts = new Map<string, { to: string; subject: string; body: string }>();
let draftCounter = 0;

export async function executeTool(
  action: string,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  switch (action) {
    case "web_search":
      return typeof params.query === "string"
        ? webSearch(params.query)
        : { success: false, error: "Missing query" };
    case "draft_email":
      return isString(params.to) &&
        isString(params.subject) &&
        isString(params.body)
        ? draftEmail(params.to, params.subject, params.body)
        : { success: false, error: "Missing to/subject/body" };
    case "send_email":
      return isString(params.draftId)
        ? sendEmail(params.draftId)
        : { success: false, error: "Missing draftId" };
    default:
      return { success: false, error: `Unknown tool: ${action}` };
  }
}

async function webSearch(query: string): Promise<ToolResult> {
  if (!query.trim()) return { success: false, error: "Missing query" };
  await delay(300);
  return {
    success: true,
    data: [
      { title: `Result for "${query}" #1`, snippet: "Placeholder snippet A." },
      { title: `Result for "${query}" #2`, snippet: "Placeholder snippet B." },
    ],
  };
}

async function draftEmail(
  to: string,
  subject: string,
  body: string,
): Promise<ToolResult> {
  if (!to || !subject || !body) {
    return { success: false, error: "Missing to/subject/body" };
  }
  const draftId = `draft_${++draftCounter}`;
  drafts.set(draftId, { to, subject, body });
  return { success: true, data: { draftId, to, subject, body } };
}

async function sendEmail(draftId: string): Promise<ToolResult> {
  const draft = drafts.get(draftId);
  if (!draft) return { success: false, error: `No draft found: ${draftId}` };

  if (Math.random() < 0.2) {
    return { success: false, error: "Simulated transient send failure" };
  }

  return { success: true, data: { sentTo: draft.to, subject: draft.subject } };
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ToolHandler = (input: unknown) => Promise<unknown>;

export class ToolRegistry {
  private readonly handlers = new Map<string, ToolHandler>();

  register(name: string, handler: ToolHandler): void {
    if (this.handlers.has(name)) {
      throw new Error(`Tool "${name}" is already registered.`);
    }
    this.handlers.set(name, handler);
  }

  async execute(call: ToolCall): Promise<ToolResult> {
    const handler = this.handlers.get(call.name);
    if (!handler) {
      return isRecord(call.input)
        ? executeTool(call.name, call.input)
        : { success: false, error: `Invalid input for tool "${call.name}"` };
    }
    return { success: true, data: await handler(call.input) };
  }
}
