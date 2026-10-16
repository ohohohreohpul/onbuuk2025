// Minimal IMAP client (RFC 3501 subset) for reading new mails from a shop's
// own mailbox: LOGIN, SELECT, UID SEARCH, UID FETCH BODY.PEEK[], LOGOUT.
// Mails are only read (PEEK) — the shop's mailbox stays as it is.
// Implicit TLS only (port 993); Supabase edge functions allow it.

import { isPublicHostName, resolvesPublicly } from "./publicHost.ts";

const COMMAND_TIMEOUT_MS = 20_000;
const READ_TIMEOUT_MS = 10_000;
const MAX_LITERAL_BYTES = 3_000_000;
const MAX_MESSAGE_BYTES = 2_000_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class ImapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImapError";
  }
}

/** Quoted IMAP string; rejects CR/LF so credentials cannot inject commands. */
export function imapQuote(value: string): string {
  if (/[\r\n]/.test(value)) throw new ImapError("Invalid characters");
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** "* SEARCH 4 7 9" lines -> [4, 7, 9]. */
export function parseSearch(lines: string[]): number[] {
  return lines
    .filter((l) => l.startsWith("* SEARCH"))
    .flatMap((l) => l.slice("* SEARCH".length).trim().split(/\s+/))
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
}

/** UIDVALIDITY / UIDNEXT from SELECT response lines. */
export function parseSelect(lines: string[]): { uidValidity: number | null; uidNext: number | null } {
  const find = (key: string) => {
    const line = lines.find((l) => l.includes(`[${key} `));
    const match = line?.match(new RegExp(`\\[${key} (\\d+)\\]`));
    return match ? Number(match[1]) : null;
  };
  return { uidValidity: find("UIDVALIDITY"), uidNext: find("UIDNEXT") };
}

interface Response {
  lines: string[];
  literals: Uint8Array[];
}

export class ImapClient {
  private conn: Deno.TlsConn | null = null;
  private buffer = new Uint8Array(0);
  private tag = 0;

  async connect(hostname: string, port: number): Promise<void> {
    this.conn = await Deno.connectTls({ hostname, port });
    const greeting = await this.readLine();
    if (!greeting.startsWith("* OK")) throw new ImapError(`Unexpected greeting: ${greeting.slice(0, 80)}`);
  }

  async login(username: string, password: string): Promise<void> {
    await this.command(`LOGIN ${imapQuote(username)} ${imapQuote(password)}`, "Login failed — check user name and password");
  }

  async selectInbox(): Promise<{ uidValidity: number | null; uidNext: number | null }> {
    const res = await this.command("SELECT INBOX", "Could not open the inbox");
    return parseSelect(res.lines);
  }

  async searchUidsAfter(lastUid: number): Promise<number[]> {
    const res = await this.command(`UID SEARCH UID ${lastUid + 1}:*`, "Search failed");
    // "n:*" always returns the highest UID even when it is <= lastUid.
    return parseSearch(res.lines).filter((uid) => uid > lastUid).sort((a, b) => a - b);
  }

  async fetchRaw(uid: number): Promise<Uint8Array | null> {
    const res = await this.command(`UID FETCH ${uid} (BODY.PEEK[])`, "Fetch failed");
    const literal = res.literals[0];
    if (!literal || literal.length > MAX_MESSAGE_BYTES) return null;
    return literal;
  }

  async logout(): Promise<void> {
    try {
      if (this.conn) await this.command("LOGOUT", "Logout failed");
    } catch {
      // closing anyway
    } finally {
      try { this.conn?.close(); } catch { /* already closed */ }
      this.conn = null;
    }
  }

  private async command(text: string, failure: string): Promise<Response> {
    if (!this.conn) throw new ImapError("Not connected");
    const tag = `z${++this.tag}`;
    await this.conn.write(encoder.encode(`${tag} ${text}\r\n`));
    const response: Response = { lines: [], literals: [] };
    const deadline = Date.now() + COMMAND_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const line = await this.readLine();
      const literalSize = line.match(/\{(\d+)\}$/);
      if (literalSize) {
        const size = Number(literalSize[1]);
        if (size > MAX_LITERAL_BYTES) throw new ImapError(`${failure}: message too large`);
        response.literals.push(await this.readBytes(size));
        response.lines.push(line);
        continue;
      }
      if (line.startsWith(`${tag} `)) {
        if (!line.startsWith(`${tag} OK`)) throw new ImapError(`${failure}: ${line.slice(tag.length + 1, 160)}`);
        return response;
      }
      response.lines.push(line);
    }
    throw new ImapError(`${failure}: timeout`);
  }

  private async fill(): Promise<void> {
    if (!this.conn) throw new ImapError("Not connected");
    const chunk = new Uint8Array(32 * 1024);
    let timer: number | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new ImapError("Mail server did not answer in time")), READ_TIMEOUT_MS);
    });
    const read = await Promise.race([this.conn.read(chunk), timeout]).finally(() => clearTimeout(timer));
    if (read === null) throw new ImapError("Connection closed by server");
    const next = new Uint8Array(this.buffer.length + read);
    next.set(this.buffer);
    next.set(chunk.subarray(0, read), this.buffer.length);
    this.buffer = next;
  }

  private async readLine(): Promise<string> {
    for (;;) {
      const index = this.buffer.findIndex((byte, i) => byte === 13 && this.buffer[i + 1] === 10);
      if (index === -1 && this.buffer.length > MAX_LITERAL_BYTES) throw new ImapError("Line too long");
      if (index !== -1) {
        const line = decoder.decode(this.buffer.subarray(0, index));
        this.buffer = this.buffer.slice(index + 2);
        return line;
      }
      await this.fill();
    }
  }

  private async readBytes(size: number): Promise<Uint8Array> {
    while (this.buffer.length < size) await this.fill();
    const bytes = this.buffer.slice(0, size);
    this.buffer = this.buffer.slice(size);
    return bytes;
  }
}

/** Only public mail servers: no IP literals, no internal names, no private addresses after DNS. */
export async function assertPublicMailHost(host: string): Promise<void> {
  if (!isPublicHostName(host)) throw new ImapError("Please enter the mail server's name, e.g. imap.strato.de");
  if (!(await resolvesPublicly(host))) throw new ImapError("This mail server name could not be found");
}
