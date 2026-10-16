// "How it talks": the shop's conversation protocol for fixed situations.
// The owner writes a short example per situation; the AI follows its tone and
// order but takes every fact (prices, times, names) from the app's data.

export const PLAYBOOK_SITUATIONS = [
  "greeting", "booking_order", "price_question", "no_free_time", "after_booking", "voucher_question", "handover", "goodbye",
] as const;

export type Situation = (typeof PLAYBOOK_SITUATIONS)[number];
export type Playbook = Partial<Record<Situation, { enabled: boolean; example: string }>>;

export const MAX_EXAMPLE_CHARS = 400;

const WHEN: Record<Situation, string> = {
  greeting: "Your very first reply in a conversation (no earlier message from you)",
  booking_order: "Taking a booking: what to ask, in this order",
  price_question: "The customer asks about prices",
  no_free_time: "Nothing is free at the time the customer wants",
  after_booking: "Right after a booking is made",
  voucher_question: "The customer asks about vouchers or gift cards",
  handover: "You are unsure or hand over to the team",
  goodbye: "The customer says thanks or goodbye",
};

/** Fills {assistant}, {shop}, {name}; unknown placeholders stay as they are. */
export function fillPlaceholders(text: string, values: { assistant: string; shop: string; name: string | null }): string {
  return text
    .replace(/\{assistant\}/gi, values.assistant)
    .replace(/\{shop\}/gi, values.shop)
    .replace(/\{name\}/gi, values.name ?? "");
}

/** Validates owner input: known situations only, trimmed, length-capped. */
export function sanitizePlaybook(input: unknown): Playbook {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const result: Playbook = {};
  for (const situation of PLAYBOOK_SITUATIONS) {
    const entry = (input as Record<string, unknown>)[situation] as { enabled?: unknown; example?: unknown } | undefined;
    if (!entry || typeof entry !== "object") continue;
    const example = typeof entry.example === "string" ? entry.example.replace(/\s+\n/g, "\n").trim().slice(0, MAX_EXAMPLE_CHARS) : "";
    result[situation] = { enabled: entry.enabled === true && example.length > 0, example };
  }
  return result;
}

/** Prompt section, or null when nothing is switched on. */
export function formatPlaybook(playbook: Playbook | null | undefined, values: { assistant: string; shop: string; name: string | null }): string | null {
  const active = PLAYBOOK_SITUATIONS.filter((s) => playbook?.[s]?.enabled && playbook[s]!.example.trim());
  if (active.length === 0) return null;
  return [
    "",
    "## How this shop wants you to talk (follow tone and order; facts only from SHOP DATA and tools; the examples are guides, not texts to copy word for word)",
    ...active.map((s) => `- ${WHEN[s]}: "${fillPlaceholders(playbook![s]!.example, values).replace(/\s*\n\s*/g, " ").replace(/"/g, "'")}"`),
  ].join("\n");
}
