// ---------------------------------------------------------------------------
// TypeSafe (Jev / System One) semantic bridge for the agent booking layer.
//
// Turns free-form natural-language agent requests into typed, confidence-gated
// booking decisions. Runs server-side only; the TYPESAFE_API_KEY is never
// exposed to the client.
//
// The pure helpers gateConfidence + routeIntentFallback mirror the single
// source of truth in src/lib/agentLogic.ts (edge functions cannot import from
// src/ at deploy time). Keep both in sync.
//
// Docs: https://docs.typesafe.ai/api.md  (POST /v1/systemone)
// ---------------------------------------------------------------------------

const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const TYPESAFE_MODEL = "jev-latest";

/** Below this confidence, mutating actions need an explicit confirm flag. */
export const AGENT_CONFIDENCE_THRESHOLD = 0.7;

export type Intent =
  | "search"
  | "availability"
  | "hold"
  | "book"
  | "cancel"
  | "reschedule";

export interface ServiceCandidate {
  id: string;
  name: string;
  description?: string | null;
}

export interface SlotCandidate {
  /** ISO label shown to the model, e.g. "Tue 2026-10-06 14:00". */
  label: string;
  /** Opaque token the caller uses to reference the chosen slot. */
  token: string;
}

// --- raw API ---------------------------------------------------------------

type QuestionType = "noul" | "choice" | "score";

interface QuestionSpec {
  type: QuestionType;
  instructions: string | object;
  criteria?: Record<string, string> | string[];
}

interface SystemOneResponse {
  answers: Record<
    string,
    | { choice?: string; probabilities?: Record<string, number>; confidence?: number }
    | { noul?: number }
    | { score?: number; confidence?: number }
  >;
}

async function typesafeEvaluate(
  state: string | object,
  questions: Record<string, QuestionSpec>,
): Promise<SystemOneResponse> {
  const apiKey = Deno.env.get("TYPESAFE_API_KEY");
  if (!apiKey) {
    throw new Error("TYPESAFE_API_KEY is not configured");
  }

  const body = { state, model: TYPESAFE_MODEL, questions };
  const res = await fetch(TYPESAFE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TypeSafe request failed (${res.status}): ${text}`);
  }

  return (await res.json()) as SystemOneResponse;
}

// --- intent routing --------------------------------------------------------

const INTENT_CRITERIA: Record<string, string> = {
  search:
    "The user wants to discover or find businesses, e.g. 'find a salon in Hamburg' or 'where can I get a haircut'.",
  availability:
    "The user wants to know when slots are free, e.g. 'what times are open next Tuesday' or 'do you have anything tomorrow afternoon'.",
  hold:
    "The user wants to tentatively reserve a slot without fully committing, e.g. 'hold that 3pm slot for me'.",
  book:
    "The user wants to make a confirmed booking, e.g. 'book me in', 'make an appointment', 'schedule it'.",
  cancel:
    "The user wants to cancel an existing booking, e.g. 'cancel my appointment', 'I can't make it'.",
  reschedule:
    "The user wants to move an existing booking to a different time, e.g. 'move it to Thursday', 'reschedule'.",
};

export interface IntentResult {
  intent: Intent;
  confidence: number;
}

export async function routeIntent(requestText: string): Promise<IntentResult> {
  const questions: Record<string, QuestionSpec> = {
    intent: {
      type: "choice",
      instructions:
        "Pick the single booking intent that best matches the user's request.",
      criteria: INTENT_CRITERIA,
    },
  };

  const res = await typesafeEvaluate({ request: requestText }, questions);
  const ans = res.answers.intent as
    | { choice?: string; confidence?: number }
    | undefined;

  const intent = (ans?.choice ?? "search") as Intent;
  const confidence = ans?.confidence ?? 0;
  return { intent, confidence };
}

// --- service normalization -------------------------------------------------

export interface ServiceMatchResult {
  serviceId: string | null;
  confidence: number;
  /** True when no candidate matched the user's phrase. */
  noMatch: boolean;
}

export async function normalizeService(
  userPhrase: string,
  candidates: ServiceCandidate[],
): Promise<ServiceMatchResult> {
  if (candidates.length === 0) {
    return { serviceId: null, confidence: 0, noMatch: true };
  }

  const criteria: Record<string, string> = {};
  for (const c of candidates) {
    criteria[c.id] = `${c.name}${c.description ? ` — ${c.description}` : ""}`;
  }
  // Add an explicit no-match option so the model is not forced to pick.
  criteria["__none__"] =
    "No listed service matches what the user asked for; the request refers to something else or is too vague.";

  const questions: Record<string, QuestionSpec> = {
    service: {
      type: "choice",
      instructions:
        "Select the service the user is asking for from the business's catalog.",
      criteria,
    },
    no_match: {
      type: "noul",
      instructions:
        "Is the user's phrase referring to a service that is NOT in the candidate list?",
    },
  };

  const res = await typesafeEvaluate(
    { userPhrase, catalog: candidates },
    questions,
  );
  const choice = res.answers.service as
    | { choice?: string; confidence?: number }
    | undefined;
  const noul = res.answers.no_match as { noul?: number } | undefined;

  const chosen = choice?.choice ?? "__none__";
  const noMatch = chosen === "__none__" || (noul?.noul ?? 0) > 0.5;
  return {
    serviceId: noMatch ? null : chosen,
    confidence: choice?.confidence ?? 0,
    noMatch,
  };
}

// --- slot resolution -------------------------------------------------------

export interface SlotResolveResult {
  slotToken: string | null;
  confidence: number;
}

export async function resolveSlot(
  userPhrase: string,
  slots: SlotCandidate[],
): Promise<SlotResolveResult> {
  if (slots.length === 0) {
    return { slotToken: null, confidence: 0 };
  }

  const criteria: Record<string, string> = {};
  for (const s of slots) {
    criteria[s.token] = s.label;
  }
  criteria["__none__"] =
    "None of the listed slots fit what the user asked for.";

  const questions: Record<string, QuestionSpec> = {
    slot: {
      type: "choice",
      instructions:
        "Select the available slot that best matches the user's time preference.",
      criteria,
    },
  };

  const res = await typesafeEvaluate({ userPhrase, slots }, questions);
  const ans = res.answers.slot as
    | { choice?: string; confidence?: number }
    | undefined;
  const chosen = ans?.choice ?? "__none__";
  return {
    slotToken: chosen === "__none__" ? null : chosen,
    confidence: ans?.confidence ?? 0,
  };
}

// --- confidence gating -----------------------------------------------------

export interface GateResult {
  proceed: boolean;
  needsConfirmation: boolean;
  reason: string;
}

/**
 * Pure confidence gate for mutating actions. High confidence OR an explicit
 * confirm flag lets the action proceed; otherwise the caller must return a
 * clarification payload and create nothing.
 */
export function gateConfidence(
  action: "book" | "cancel" | "reschedule",
  confidence: number,
  confirmFlag: boolean,
  threshold: number = AGENT_CONFIDENCE_THRESHOLD,
): GateResult {
  if (confidence >= threshold) {
    return { proceed: true, needsConfirmation: false, reason: "confidence_ok" };
  }
  if (confirmFlag) {
    return {
      proceed: true,
      needsConfirmation: false,
      reason: "explicit_confirm",
    };
  }
  return {
    proceed: false,
    needsConfirmation: true,
    reason: `low_confidence_for_${action}`,
  };
}

// --- graceful fallback when TypeSafe is unavailable -----------------------

/**
 * When TypeSafe cannot be reached, mutating actions must NOT proceed on
 * inference alone. Intent routing falls back to a keyword heuristic so
 * read-only flows still work; mutating flows require an explicit confirm.
 */
export function routeIntentFallback(requestText: string): IntentResult {
  const text = requestText.toLowerCase();
  if (/\b(cancel|stornier|storno)/.test(text)) return { intent: "cancel", confidence: 0 };
  if (/\b(reschedule|rebook|verschieb|\bmove\b)/.test(text)) {
    return { intent: "reschedule", confidence: 0 };
  }
  if (/\b(book|appoint|reserv|termin|buchen)/.test(text)) {
    return { intent: "book", confidence: 0 };
  }
  if (/\b(hold|festhalten)/.test(text)) {
    return { intent: "hold", confidence: 0 };
  }
  if (/\b(when|free|open|available|verfüg|frei)/.test(text)) {
    return { intent: "availability", confidence: 0 };
  }
  return { intent: "search", confidence: 0 };
}

export function isTypesafeConfigured(): boolean {
  return Boolean(Deno.env.get("TYPESAFE_API_KEY"));
}