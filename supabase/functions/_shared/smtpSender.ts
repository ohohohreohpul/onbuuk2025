/**
 * SMTP sending for shops that send from their own mailbox (e.g. info@shop.de at
 * Strato: smtp.strato.de, port 465, SSL, full address as user name).
 *
 * Supabase Edge Functions block outgoing ports 25 and 587, so only implicit TLS
 * on 465 works. A clear error tells the shop owner what to change.
 */
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

export const SMTP_PORT = 465;
const BLOCKED_PORTS = [25, 587];

export interface SmtpSettings {
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_username?: string | null;
  smtp_password?: string | null;
  from_email: string;
  from_name?: string | null;
}

export interface SmtpAttachment {
  filename: string;
  content: string; // base64
  contentType: string;
}

export interface SmtpMessage {
  to: string;
  subject: string;
  html: string;
  attachments?: SmtpAttachment[];
}

/** Throws a message the shop owner can act on, or returns the connection settings. */
export function smtpConnection(settings: SmtpSettings) {
  const hostname = settings.smtp_host?.trim();
  const username = settings.smtp_username?.trim();
  const password = settings.smtp_password ?? "";
  const port = settings.smtp_port || SMTP_PORT;

  if (!hostname || !username || !password) {
    throw new Error("SMTP is not complete: server, user name and password are required.");
  }
  if (BLOCKED_PORTS.includes(port)) {
    throw new Error(`Port ${port} cannot be used from our servers. Use port ${SMTP_PORT} (SSL/TLS) instead.`);
  }
  return { hostname, port, tls: true, auth: { username, password } };
}

/** Display name is quoted so commas or umlauts in shop names stay intact. */
export function formatSender(fromEmail: string, fromName?: string | null): string {
  const name = fromName?.replace(/["\\\r\n]/g, "").trim();
  return name ? `"${name}" <${fromEmail}>` : fromEmail;
}

export async function sendWithSmtp(settings: SmtpSettings, message: SmtpMessage): Promise<{ id: string }> {
  const client = new SMTPClient({ connection: smtpConnection(settings) });
  try {
    await client.send({
      from: formatSender(settings.from_email, settings.from_name),
      to: message.to,
      subject: message.subject,
      html: message.html,
      content: "auto",
      attachments: (message.attachments ?? []).map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        encoding: "base64" as const,
        contentType: attachment.contentType,
      })),
    });
    return { id: `smtp-${crypto.randomUUID()}` };
  } finally {
    try {
      await client.close();
    } catch {
      // The message is already sent; a failed QUIT does not matter.
    }
  }
}
