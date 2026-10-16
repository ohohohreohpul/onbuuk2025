// Makes AI replies read like a person texting: no markdown, short messages,
// a typing pause that fits the length. Pure functions (unit-tested).
// Writing rules adapted from "humanizer" by Siqi Chen (MIT,
// https://github.com/blader/humanizer), based on Wikipedia's "Signs of AI writing".

const MAX_PARTS = 3;
const MS_PER_CHAR = 30;
const MIN_TYPING_MS = 1_200;
const MAX_TYPING_MS = 5_000;

/** Removes markdown the model may still produce: **bold**, bullets, headings. (Numbered lines stay: "17. Oktober".) */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]*[*•\-–][ \t]+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Splits at blank lines into at most 3 messages (the rest joins the last one). */
export function splitIntoMessages(text: string): string[] {
  const parts = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= MAX_PARTS) return parts.length ? parts : [text.trim()];
  return [...parts.slice(0, MAX_PARTS - 1), parts.slice(MAX_PARTS - 1).join("\n\n")];
}

/** How long a person would take to type this (1.2–5 s). */
export function typingDelayMs(text: string): number {
  return Math.min(MAX_TYPING_MS, Math.max(MIN_TYPING_MS, text.length * MS_PER_CHAR));
}

/** Stock chatbot openers/closers that no receptionist would type (EN/DE). */
const RESIDUE = [
  /^(certainly|of course|absolutely|great question|good question)[!.,]\s*/i,
  /^(selbstverständlich|sehr gute frage|gute frage)[!.,]\s*/i,
  /\s*(i hope this helps|hope this helps|ich hoffe, das hilft( (dir|ihnen) weiter)?)[.!]?\s*$/i,
  /\s*(let me know if (you have any (other|more|further) questions|there('| i)s anything else i can help with)|lass(t)? mich wissen, (falls|wenn) (du|ihr) (noch )?fragen ha(st|bt)|lassen sie mich wissen, (falls|wenn) sie (noch )?fragen haben)[.!]?\s*$/i,
];

/** Light, safe clean-up of AI tells; anything structural is the prompt's job. */
export function humanizeText(text: string): string {
  let result = stripMarkdown(text)
    // Spaced em/en dashes used as connectors -> comma. "10:00–20:00" (no spaces) stays.
    .replace(/\s+[—–]\s+/g, ", ")
    .replace(/\s+--\s+/g, ", ");
  for (const pattern of RESIDUE) result = result.replace(pattern, "");
  return result.replace(/\n{3,}/g, "\n\n").trim();
}
