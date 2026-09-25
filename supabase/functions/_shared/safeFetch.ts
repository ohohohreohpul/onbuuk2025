/**
 * Fetches a calendar link a shop pasted in. The link is untrusted input, so:
 * https only, no internal/private hosts, each redirect re-checked, a timeout and
 * a size cap.
 */

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 12_000;
export const MAX_ICS_BYTES = 5 * 1024 * 1024;

export class UnsafeUrlError extends Error {}

const BLOCKED_HOST_SUFFIXES = [".local", ".internal", ".localhost", ".lan", ".home.arpa"];

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || !host.includes(".") && !host.includes(":")) return true;
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  if (host.includes(":")) return true; // IPv6 literals: calendar providers use names
  if (/^[\d.]+$/.test(host)) return isPrivateIpv4(host) || host.split(".").length !== 4;
  return false;
}

/** webcal:// is how Apple and Outlook share subscriptions; it is plain https underneath. */
export function normaliseCalendarUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim().replace(/^webcals?:\/\//i, "https://"));
  } catch {
    throw new UnsafeUrlError("This is not a valid link.");
  }
  if (url.protocol !== "https:") throw new UnsafeUrlError("The link must start with https://");
  if (url.username || url.password) throw new UnsafeUrlError("Links with a login inside are not supported.");
  if (url.port && url.port !== "443") throw new UnsafeUrlError("This link uses an unusual port.");
  if (isBlockedHost(url.hostname)) throw new UnsafeUrlError("This address is not reachable from the internet.");
  // Importing Zenno's own export would block every booking against itself.
  if (url.pathname.includes("/functions/v1/calendar-feed")) {
    throw new UnsafeUrlError("This is a Zenno booking link. Paste the link of the other calendar instead.");
  }
  return url;
}

async function readLimited(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_ICS_BYTES) throw new Error("The calendar file is larger than 5 MB.");
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_ICS_BYTES) {
      await reader.cancel();
      throw new Error("The calendar file is larger than 5 MB.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function fetchCalendarText(rawUrl: string): Promise<string> {
  let url = normaliseCalendarUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "text/calendar, text/plain;q=0.8", "User-Agent": "ZennoHQ-CalendarSync/1.0" },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error("The calendar link redirected nowhere.");
      url = normaliseCalendarUrl(new URL(location, url).toString());
      continue;
    }

    if (response.status === 401 || response.status === 403 || response.status === 404) {
      await response.body?.cancel();
      throw new Error("The calendar link is private or no longer valid. Copy a fresh link.");
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`The calendar server answered ${response.status}.`);
    }

    const text = await readLimited(response);
    if (!text.includes("BEGIN:VCALENDAR")) {
      throw new Error("This link is not a calendar (.ics) file. Use the iCal/ICS address.");
    }
    return text;
  }

  throw new Error("The calendar link redirected too many times.");
}
