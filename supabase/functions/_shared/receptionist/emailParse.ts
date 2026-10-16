// Turns a raw inbound email into what the receptionist needs, and decides
// which mails it must never answer (newsletters, auto-replies, bounces).

import PostalMime from "npm:postal-mime@2.4.3";

const MAX_BODY_CHARS = 6000;
const NO_REPLY = /(^|[._+-])(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounce[s]?|notifications?)([._+-]|@)/i;
const QUOTE_MARKERS = [
  /^On .{4,200} wrote:\s*$/m,
  /^Am .{4,200} schrieb .{0,200}:\s*$/m,
  /^-{2,}\s*(Original Message|Ursprüngliche Nachricht)\s*-{2,}/im,
  /^From: .+$/m,
  /^Von: .+$/m,
  /^_{10,}\s*$/m,
];

export interface ParsedEmail {
  messageId: string | null;
  inReplyTo: string | null;
  references: string | null;
  fromAddress: string | null;
  fromName: string | null;
  subject: string;
  body: string;
  isAutomated: boolean;
  /** The receiving server confirmed the From domain (DMARC, DKIM or SPF pass, aligned). */
  isSenderVerified: boolean;
}

type HeaderList = { key: string; value: string }[];

const header = (headers: HeaderList, key: string) => headers.find((h) => h.key.toLowerCase() === key)?.value ?? null;

/** Newsletters, auto-replies, bounces and no-reply senders get no answer. */
export function isAutomatedMail(headers: HeaderList, fromAddress: string | null): boolean {
  if (!fromAddress || NO_REPLY.test(fromAddress)) return true;
  const autoSubmitted = header(headers, "auto-submitted");
  if (autoSubmitted && autoSubmitted.toLowerCase() !== "no") return true;
  if (/^(bulk|list|junk|auto_reply)$/i.test(header(headers, "precedence") ?? "")) return true;
  if (header(headers, "list-unsubscribe") || header(headers, "list-id")) return true;
  if (header(headers, "x-autoreply") || header(headers, "x-autorespond")) return true;
  return false;
}

const aligned = (domain: string | undefined, fromDomain: string) =>
  Boolean(domain) && (fromDomain === domain!.toLowerCase() || fromDomain.endsWith(`.${domain!.toLowerCase()}`));

/**
 * Trusts the From address only if the topmost Authentication-Results header
 * (added by the shop's own mail server) shows dmarc/dkim/spf=pass for the
 * From domain. A bare From header can be forged by anyone.
 */
export function isSenderVerified(headers: HeaderList, fromAddress: string | null): boolean {
  const fromDomain = fromAddress?.split("@")[1]?.toLowerCase();
  const results = headers.find((h) => h.key.toLowerCase() === "authentication-results")?.value;
  if (!fromDomain || !results) return false;
  const text = results.replace(/\s+/g, " ");
  const dmarc = /dmarc=pass[^;]*header\.from=([^\s;]+)/i.exec(text);
  if (dmarc && aligned(dmarc[1], fromDomain)) return true;
  for (const match of text.matchAll(/dkim=pass[^;]*header\.(?:d|i)=@?([^\s;]+)/gi)) {
    if (aligned(match[1], fromDomain)) return true;
  }
  const spf = /spf=pass[^;]*smtp\.mailfrom=(?:[^@\s;]*@)?([^\s;]+)/i.exec(text);
  return Boolean(spf && aligned(spf[1], fromDomain));
}

/** Keeps the customer's new text, drops the quoted conversation below it. */
export function stripQuotedReply(text: string): string {
  let cut = text.length;
  for (const marker of QUOTE_MARKERS) {
    const match = marker.exec(text);
    if (match && match.index > 0 && match.index < cut) cut = match.index;
  }
  return text
    .slice(0, cut)
    .split(/\r?\n/)
    .filter((line) => !line.startsWith(">"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_BODY_CHARS);
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

export async function parseEmail(raw: Uint8Array): Promise<ParsedEmail> {
  const mail = await PostalMime.parse(raw);
  const headers = (mail.headers ?? []) as HeaderList;
  const fromAddress = mail.from?.address?.toLowerCase().trim() || null;
  const text = mail.text?.trim() ? mail.text : htmlToText(mail.html ?? "");
  return {
    messageId: mail.messageId ?? null,
    inReplyTo: mail.inReplyTo ?? null,
    references: mail.references ?? null,
    fromAddress,
    fromName: mail.from?.name?.trim() || null,
    subject: (mail.subject ?? "").trim().slice(0, 300),
    body: stripQuotedReply(text),
    isAutomated: isAutomatedMail(headers, fromAddress),
    isSenderVerified: isSenderVerified(headers, fromAddress),
  };
}

/** "Re: …" exactly once. */
export function replySubject(subject: string | null): string {
  const base = (subject ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 200);
  if (!base) return "Re: Ihre Anfrage";
  return /^(re|aw|antw)\s*:/i.test(base) ? base : `Re: ${base}`;
}

/** Plain text -> minimal HTML email body (escaped, paragraphs kept). */
export function textToHtml(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paragraphs = escaped.split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${p.replace(/\n/g, "<br>")}</p>`);
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1A1714">${paragraphs.join("")}</div>`;
}

/** A Message-ID that is safe to put into In-Reply-To / References. */
export function safeMessageId(value: string | null | undefined): string | null {
  const id = (value ?? "").trim();
  return /^<[^\s<>]{3,300}>$/.test(id) ? id : null;
}
