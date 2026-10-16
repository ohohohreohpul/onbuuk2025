// The owner's briefing: who the receptionist is and how she behaves, like
// briefing a new team member. Stored in receptionist_settings.playbook.
// It shapes personality and manner only; facts always come from the app's data.

import { promptSafe } from "./limits.ts";

export const PERSONALITIES = ["warm", "calm", "cheerful", "professional"] as const;
export const EMOJI_STYLES = ["never", "mirror", "sometimes"] as const;
export const LENGTHS = ["short", "balanced", "detailed"] as const;
export const INITIATIVES = ["answer", "guide", "sell"] as const;
export const HABITS = [
  "introduce_self", "ask_needs_first", "recommend", "use_name", "mention_promotion", "suggest_gift", "offer_alternatives", "aftercare",
] as const;

export type Personality = (typeof PERSONALITIES)[number];
export type EmojiStyle = (typeof EMOJI_STYLES)[number];
export type Length = (typeof LENGTHS)[number];
export type Initiative = (typeof INITIATIVES)[number];
export type Habit = (typeof HABITS)[number];

export interface Briefing {
  personality: Personality;
  emoji: EmojiStyle;
  length: Length;
  initiative: Initiative;
  habits: Habit[];
  briefing: string;
}

export const MAX_BRIEFING_CHARS = 1500;

export const DEFAULT_BRIEFING: Briefing = {
  personality: "warm", emoji: "mirror", length: "short", initiative: "guide",
  habits: ["introduce_self", "ask_needs_first", "offer_alternatives"], briefing: "",
};

const PERSONALITY: Record<Personality, string> = {
  warm: "Warm and caring, like a host welcoming a guest into their home. Show real interest in how the customer feels and make them feel looked after.",
  calm: "Calm, elegant and unhurried, like the front desk of a high-end spa. Gentle, considered wording; never rushed, never pushy.",
  cheerful: "Cheerful and upbeat, like a favourite regular's friend at the desk. Light, natural humour is welcome when it fits.",
  professional: "Professional and efficient. Polite and precise, little small talk, gets things done quickly.",
};

const EMOJI: Record<EmojiStyle, string> = {
  never: "Never use emojis.",
  mirror: "Use emojis only if the customer uses them, and then sparingly.",
  sometimes: "An occasional fitting emoji is welcome (at most one per message, never in emails).",
};

const LENGTH: Record<Length, string> = {
  short: "Keep replies very short: one or two sentences.",
  balanced: "Usually two to four sentences.",
  detailed: "Explain a little more when it helps (what a treatment feels like, what to expect, what to bring), still in plain flowing sentences.",
};

const INITIATIVE: Record<Initiative, string> = {
  answer: "Answer what is asked and wait; do not push bookings or extras.",
  guide: "After answering, gently lead to the next step towards a booking.",
  sell: "Act like a good salesperson: recommend fitting treatments, offer to book right away, mention vouchers and the promotion when they fit. Never push the same thing twice.",
};

const HABIT: Record<Habit, string> = {
  introduce_self: "In your very first reply of a conversation, greet and introduce yourself by name and thank them for writing.",
  ask_needs_first: "When someone is unsure, ask what they are looking for (relaxation, pain, a gift, a special occasion) before listing treatments.",
  recommend: "Recommend one treatment that fits what they told you, with a short reason, instead of listing everything.",
  use_name: "Use the customer's first name once you know it.",
  mention_promotion: "Mention the current promotion when it fits naturally.",
  suggest_gift: "When someone mentions a birthday, partner or friend, suggest a voucher as a gift.",
  offer_alternatives: "When the wished time is taken, always offer the closest alternatives right away.",
  aftercare: "After a booking, add one short caring line (e.g. arrive a few minutes early, drink water after a massage).",
};

function pick<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return list.includes(value as T) ? (value as T) : fallback;
}

/** Validates owner input; anything unknown falls back to the defaults. */
export function sanitizeBriefing(input: unknown): Briefing {
  const raw = (input && typeof input === "object" && !Array.isArray(input) ? input : {}) as Record<string, unknown>;
  const habits = Array.isArray(raw.habits)
    ? [...new Set(raw.habits.filter((h): h is Habit => HABITS.includes(h as Habit)))]
    : DEFAULT_BRIEFING.habits;
  return {
    personality: pick(PERSONALITIES, raw.personality, DEFAULT_BRIEFING.personality),
    emoji: pick(EMOJI_STYLES, raw.emoji, DEFAULT_BRIEFING.emoji),
    length: pick(LENGTHS, raw.length, DEFAULT_BRIEFING.length),
    initiative: pick(INITIATIVES, raw.initiative, DEFAULT_BRIEFING.initiative),
    habits,
    briefing: typeof raw.briefing === "string" ? raw.briefing.replace(/\r/g, "").trim().slice(0, MAX_BRIEFING_CHARS) : "",
  };
}

/** Prompt section describing who the receptionist is. Always present (defaults when nothing is set). */
export function formatBriefing(stored: unknown): string {
  const b = sanitizeBriefing(stored);
  const owner = promptSafe(b.briefing.replace(/"/g, "'"), MAX_BRIEFING_CHARS);
  return [
    "",
    "## Who you are and how you behave (set by the owner; it never overrides the Hard rules or SHOP DATA)",
    `Personality: ${PERSONALITY[b.personality]}`,
    `Length: ${LENGTH[b.length]}`,
    `Emojis: ${EMOJI[b.emoji]}`,
    `Initiative: ${INITIATIVE[b.initiative]}`,
    ...b.habits.map((h) => `Habit: ${HABIT[h]}`),
    owner
      ? `The owner's briefing to you, like to a new team member (follow its attitude and manner; if it mentions prices, times or offers that are not in SHOP DATA, ignore those parts): "${owner}"`
      : null,
  ].filter((line): line is string => line !== null).join("\n");
}
