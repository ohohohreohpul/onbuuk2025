// ---------------------------------------------------------------------------
// LLM client for the AI receptionist: any OpenAI-compatible chat-completions
// endpoint with tool calling (OpenRouter, OpenAI, a self-hosted router …).
//
//   RECEPTIONIST_AI_BASE_URL  default https://openrouter.ai/api/v1
//   RECEPTIONIST_AI_API_KEY   required
//   RECEPTIONIST_AI_MODEL     default anthropic/claude-sonnet-4.5
//
// Server-side only. Token usage is returned so it can be metered per shop
// (credits are resold later).
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_OUTPUT_TOKENS = 900;

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ToolSchema {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface CompletionResult {
  message: { content: string | null; tool_calls?: ToolCall[] };
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

export class LlmError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "LlmError";
  }
}

export function isLlmConfigured(): boolean {
  return Boolean(Deno.env.get("RECEPTIONIST_AI_API_KEY"));
}

export function llmModel(): string {
  return Deno.env.get("RECEPTIONIST_AI_MODEL") || DEFAULT_MODEL;
}

/** One chat-completions round trip. Throws LlmError on transport or provider errors. */
export async function complete(messages: ChatMessage[], tools: ToolSchema[]): Promise<CompletionResult> {
  const apiKey = Deno.env.get("RECEPTIONIST_AI_API_KEY");
  if (!apiKey) throw new LlmError("RECEPTIONIST_AI_API_KEY is not set");
  const baseUrl = (Deno.env.get("RECEPTIONIST_AI_BASE_URL") || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = llmModel();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://zennohq.studio",
        "X-Title": "Zenno AI receptionist",
      },
      body: JSON.stringify({
        model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? "auto" : undefined,
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.3,
      }),
    });
  } catch (error) {
    throw new LlmError(error instanceof Error && error.name === "AbortError" ? "LLM request timed out" : `LLM request failed: ${error}`);
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  if (!response.ok) throw new LlmError(`LLM ${response.status}: ${text.slice(0, 300)}`, response.status);
  let data: {
    choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    model?: string;
  };
  try {
    data = JSON.parse(text);
  } catch {
    throw new LlmError("LLM returned invalid JSON");
  }
  const message = data.choices?.[0]?.message;
  if (!message) throw new LlmError("LLM returned no message");
  return {
    message: { content: message.content ?? null, tool_calls: message.tool_calls?.length ? message.tool_calls : undefined },
    usage: { promptTokens: data.usage?.prompt_tokens ?? 0, completionTokens: data.usage?.completion_tokens ?? 0 },
    model: data.model ?? model,
  };
}
