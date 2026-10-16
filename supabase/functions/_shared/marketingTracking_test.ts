import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import { addTracking, linkSignature } from "./marketingTracking.ts";

const token = "0b8f2a52-6a5e-4d6c-9a7e-1f2b3c4d5e6f";
const base = "https://book.zennohq.com/api/m";

Deno.test("tracking: wraps https links, keeps the unsubscribe link, adds one open image", async () => {
  const html = '<html><body><a href="https://shop.de/?gutschein=1&amp;x=2">Buy</a> <a href="https://unsub.example/u?t=1">Abmelden</a> <a href="mailto:a@b.de">Mail</a></body></html>';
  const out = await addTracking(html, { base, secret: "s3cret", token, keep: ["https://unsub.example/u?t=1"] });
  const signature = await linkSignature("s3cret", token, "https://shop.de/?gutschein=1&x=2");
  assert(out.includes(`href="${base}?c=${token}&amp;u=${encodeURIComponent("https://shop.de/?gutschein=1&x=2")}&amp;s=${signature}"`));
  assert(out.includes('href="https://unsub.example/u?t=1"'));
  assert(out.includes('href="mailto:a@b.de"'));
  assertEquals(out.split(`${base}?o=${token}`).length, 2);
  assert(out.indexOf(`?o=${token}`) < out.indexOf("</body>"));
});

Deno.test("tracking: signature depends on token, url and secret", async () => {
  const a = await linkSignature("k", token, "https://a.de");
  assertEquals(a.length, 32);
  assertFalse(a === await linkSignature("k", token, "https://b.de"));
  assertFalse(a === await linkSignature("other", token, "https://a.de"));
});
