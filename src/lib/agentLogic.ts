// ---------------------------------------------------------------------------
// Pure, framework-agnostic logic for the agent booking layer.
//
// Single source of truth for the confidence gate and the intent-routing
// fallback. The edge function supabase/functions/_shared/typesafe.ts mirrors
// these (edge functions cannot import from src/ at deploy time); keep both in
// sync. Tested by src/lib/__tests__/agentLogic.test.ts.
// ---------------------------------------------------------------------------

export type Intent =
  | 'search'
  | 'availability'
  | 'hold'
  | 'book'
  | 'cancel'
  | 'reschedule';

/** Below this confidence, mutating actions need an explicit confirm flag. */
export const AGENT_CONFIDENCE_THRESHOLD = 0.7;

export interface GateResult {
  proceed: boolean;
  needsConfirmation: boolean;
  reason: string;
}

export type GatedAction = 'book' | 'cancel' | 'reschedule';

/**
 * Confidence gate for mutating actions. High confidence OR an explicit
 * confirm flag lets the action proceed; otherwise the caller must return a
 * clarification payload and create nothing.
 */
export function gateConfidence(
  action: GatedAction,
  confidence: number,
  confirmFlag: boolean,
  threshold: number = AGENT_CONFIDENCE_THRESHOLD,
): GateResult {
  if (confidence >= threshold) {
    return { proceed: true, needsConfirmation: false, reason: 'confidence_ok' };
  }
  if (confirmFlag) {
    return { proceed: true, needsConfirmation: false, reason: 'explicit_confirm' };
  }
  return {
    proceed: false,
    needsConfirmation: true,
    reason: `low_confidence_for_${action}`,
  };
}

/**
 * Keyword fallback for intent routing when TypeSafe is unavailable. Returns
 * confidence 0 so mutating intents still require an explicit confirm flag.
 */
export function routeIntentFallback(requestText: string): { intent: Intent; confidence: number } {
  const text = requestText.toLowerCase();
  // Leading \b only: prefix matching handles inflected forms
  // ("appointment", "stornieren", "buchen", "verschieben").
  if (/\b(cancel|stornier|storno)/.test(text)) return { intent: 'cancel', confidence: 0 };
  if (/\b(reschedule|rebook|verschieb|\bmove\b)/.test(text)) {
    return { intent: 'reschedule', confidence: 0 };
  }
  if (/\b(book|appoint|reserv|termin|buchen)/.test(text)) {
    return { intent: 'book', confidence: 0 };
  }
  if (/\b(hold|festhalten)/.test(text)) {
    return { intent: 'hold', confidence: 0 };
  }
  if (/\b(when|free|open|available|verfüg|frei)/.test(text)) {
    return { intent: 'availability', confidence: 0 };
  }
  return { intent: 'search', confidence: 0 };
}