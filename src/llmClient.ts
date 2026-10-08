import "dotenv/config";
import OpenAI from "openai";
import type { AgentDecision, Message, ToolCall } from "./types";

type ChatCompletionMessageParam = OpenAI.ChatCompletionMessageParam;

export interface LlmResponse {
  content: string;
  toolCalls: ToolCall[];
}

export interface LlmClient {
  complete(messages: readonly string[]): Promise<LlmResponse>;
}

export class UnconfiguredLlmClient implements LlmClient {
  async complete(_messages: readonly string[]): Promise<LlmResponse> {
    throw new Error("No language-model provider has been configured.");
  }
}

export async function callLLM(messages: Message[]): Promise<AgentDecision> {
  const chatMessages: ChatCompletionMessageParam[] = messages.map(
    ({ role, content }) => ({ role, content }),
  );
  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    messages: chatMessages,
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content ?? "{}";

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Model returned invalid JSON: ${raw}`);
  }

  if (!isAgentDecision(parsed)) {
    throw new Error(`Model response missing or has invalid required fields: ${raw}`);
  }

  return parsed;
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "sk-your-key-here") {
    throw new Error("Set a valid OPENAI_API_KEY in your .env file to run tasks.");
  }
  return new OpenAI({ apiKey });
}

function isAgentDecision(value: unknown): value is AgentDecision {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const decision = value as Record<string, unknown>;
  return (
    typeof decision.reasoning === "string" &&
    typeof decision.action === "string" &&
    decision.action.length > 0 &&
    isRecord(decision.params) &&
    (decision.confidence === undefined ||
      (typeof decision.confidence === "number" &&
        Number.isFinite(decision.confidence) &&
        decision.confidence >= 0 &&
        decision.confidence <= 1))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
