// Adds campaign tracking to a rendered marketing email: links go through the app's
// /api/m endpoint (signed, so it can't be used to redirect anywhere else) and a 1×1
// image counts the open. The verifying side is api/m.ts (same signature format).

const SIGNATURE_LENGTH = 32;

export async function linkSignature(secret: string, token: string, url: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${token}|${url}`));
  return Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, SIGNATURE_LENGTH);
}

const decodeHref = (href: string) => href.replace(/&amp;/g, "&");
const encodeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** Rewrites https links (except the ones in `keep`) and adds the open image. */
export async function addTracking(
  html: string,
  options: { base: string; secret: string; token: string; keep: string[] },
): Promise<string> {
  const { base, secret, token, keep } = options;
  const links = new Map<string, string>();
  for (const match of html.matchAll(/href="(https:\/\/[^"]+)"/g)) {
    const url = decodeHref(match[1]);
    if (keep.includes(url) || links.has(url)) continue;
    const signature = await linkSignature(secret, token, url);
    links.set(url, `${base}?c=${token}&u=${encodeURIComponent(url)}&s=${signature}`);
  }
  const tracked = html.replace(/href="(https:\/\/[^"]+)"/g, (whole, href: string) => {
    const target = links.get(decodeHref(href));
    return target ? `href="${encodeAttr(target)}"` : whole;
  });
  const pixel = `<img src="${encodeAttr(`${base}?o=${token}`)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />`;
  return tracked.includes("</body>") ? tracked.replace("</body>", `${pixel}</body>`) : tracked + pixel;
}
