/**
 * Comment-to-DM automations ("comment BUCHEN and get the booking link"): the
 * small form the shop fills in, validated and turned into Zernio's body.
 * Pure, so the same rules run in the edge function and in tests.
 */

export interface AutomationDraft {
  name: string;
  accountId: string;
  keywords: string[];
  dmMessage: string;
  buttonTitle: string;
  buttonUrl: string;
  commentReply: string;
  isActive: boolean;
}

export const AUTOMATION_LIMITS = {
  name: 80,
  keywords: 10,
  keyword: 40,
  dmMessage: 1000,
  buttonTitle: 20,
  commentReply: 300,
} as const;

export class AutomationInputError extends Error {}

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** Reads and checks the admin's input; throws AutomationInputError with a plain message. */
export function readAutomationDraft(input: Record<string, unknown>): AutomationDraft {
  const keywords = (Array.isArray(input.keywords) ? input.keywords : [])
    .map((k) => text(k, AUTOMATION_LIMITS.keyword))
    .filter(Boolean);
  const draft: AutomationDraft = {
    name: text(input.name, AUTOMATION_LIMITS.name),
    accountId: text(input.accountId, 64),
    keywords: [...new Set(keywords.map((k) => k.toLowerCase()))].slice(0, AUTOMATION_LIMITS.keywords),
    dmMessage: text(input.dmMessage, AUTOMATION_LIMITS.dmMessage),
    buttonTitle: text(input.buttonTitle, AUTOMATION_LIMITS.buttonTitle),
    buttonUrl: text(input.buttonUrl, 2000),
    commentReply: text(input.commentReply, AUTOMATION_LIMITS.commentReply),
    isActive: input.isActive === true,
  };
  if (!draft.name) throw new AutomationInputError("Please give the automation a name.");
  if (!draft.accountId) throw new AutomationInputError("Please choose an Instagram or Facebook account.");
  if (draft.keywords.length === 0) throw new AutomationInputError("Please add at least one keyword.");
  if (!draft.dmMessage) throw new AutomationInputError("Please write the message people receive.");
  if (Boolean(draft.buttonTitle) !== Boolean(draft.buttonUrl)) throw new AutomationInputError("A button needs both a label and a link.");
  if (draft.buttonUrl && !/^https:\/\/[^\s]+$/.test(draft.buttonUrl)) throw new AutomationInputError("The button link must start with https://");
  return draft;
}

/** Body for POST /v1/comment-automations (create) or PATCH (update; without profile/account). */
export function toZernioAutomation(draft: AutomationDraft, profileId: string | null): Record<string, unknown> {
  return {
    ...(profileId ? { profileId, accountId: draft.accountId } : {}),
    name: draft.name,
    trigger: "comment",
    keywords: draft.keywords,
    // Whole words, forgiving small typos: "buchen" fires on "Buchen!" but "app" never on "happy".
    matchMode: "word",
    typoTolerance: true,
    dmMessage: draft.dmMessage,
    buttons: draft.buttonUrl ? [{ type: "url", title: draft.buttonTitle, url: draft.buttonUrl }] : [],
    ...(draft.commentReply ? { commentReply: draft.commentReply } : {}),
    isActive: draft.isActive,
  };
}

export interface AutomationSummary {
  id: string;
  name: string;
  accountId: string;
  platform: string;
  keywords: string[];
  dmMessage: string;
  buttonTitle: string;
  buttonUrl: string;
  commentReply: string;
  isActive: boolean;
  sent: number | null;
}

type Json = Record<string, unknown>;

/** Zernio's automation, reduced to what the admin screen shows. */
export function fromZernioAutomation(raw: Json): AutomationSummary {
  const button = (Array.isArray(raw.buttons) ? raw.buttons : []).find((b) => (b as Json)?.type === "url") as Json | undefined;
  const stats = (raw.stats && typeof raw.stats === "object" ? raw.stats : {}) as Json;
  const sent = [stats.dmsSent, stats.totalDmsSent, stats.sent].find((v) => typeof v === "number") as number | undefined;
  return {
    id: String(raw.id ?? raw._id ?? ""),
    name: String(raw.name ?? ""),
    accountId: String(raw.accountId ?? ""),
    platform: String(raw.platform ?? ""),
    keywords: Array.isArray(raw.keywords) ? raw.keywords.map(String) : [],
    dmMessage: String(raw.dmMessage ?? ""),
    buttonTitle: String(button?.title ?? ""),
    buttonUrl: String(button?.url ?? ""),
    commentReply: String(raw.commentReply ?? ""),
    isActive: raw.isActive !== false,
    sent: sent ?? null,
  };
}
