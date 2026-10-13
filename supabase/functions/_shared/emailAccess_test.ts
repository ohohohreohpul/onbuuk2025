import { assert, assertEquals, assertFalse, assertThrows } from "jsr:@std/assert@1";
import { assertPublicEventAllowed, escapeHtml, isServiceRoleRequest, isTrustedHost } from "./emailAccess.ts";

const NOW = Date.parse("2026-10-12T10:00:00Z");
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60000).toISOString();

Deno.test("escapes markup a customer could put in their name", () => {
  assertEquals(escapeHtml(`<a href="x">Hi</a> & 'you'`), "&lt;a href=&quot;x&quot;&gt;Hi&lt;/a&gt; &amp; &#39;you&#39;");
});

Deno.test("trusts platform, own shop subdomain, verified custom domain and localhost", () => {
  assert(isTrustedHost("book.zennohq.com", "satuuu99", []));
  assert(isTrustedHost("satuuu99.zennohq.com", "satuuu99", []));
  assert(isTrustedHost("www.satuuu99.de", "satuuu99", ["www.satuuu99.de"]));
  assert(isTrustedHost("satuuu99.localhost", "satuuu99", []));
});

Deno.test("does not trust another shop or a foreign domain", () => {
  assertFalse(isTrustedHost("other-shop.zennohq.com", "satuuu99", []));
  assertFalse(isTrustedHost("evil.example", "satuuu99", ["www.satuuu99.de"]));
  assertFalse(isTrustedHost("satuuu99.zennohq.com.evil.example", "satuuu99", []));
});

Deno.test("allows a confirmation right after booking", () => {
  assertPublicEventAllowed("booking_confirmation", "pending", minutesAgo(2), NOW);
});

Deno.test("rejects a confirmation for an old booking", () => {
  assertThrows(() => assertPublicEventAllowed("booking_confirmation", "confirmed", minutesAgo(31), NOW));
});

Deno.test("rejects a confirmation for a cancelled booking", () => {
  assertThrows(() => assertPublicEventAllowed("booking_confirmation", "cancelled", minutesAgo(1), NOW));
});

Deno.test("cancellation email only for a cancelled booking", () => {
  assertPublicEventAllowed("booking_cancelled", "cancelled", minutesAgo(5000), NOW);
  assertThrows(() => assertPublicEventAllowed("booking_cancelled", "confirmed", minutesAgo(1), NOW));
});

const NEW_KEY = "sb_secret_abcdefghijklmnopqrstuvwxyz0123";
const OTHER_SECRET = "sb_secret_zyxwvutsrqponmlkjihgfedcba9876";

Deno.test("only the project's server keys count as a server caller", () => {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", NEW_KEY);
  Deno.env.delete("SUPABASE_SECRET_KEYS");
  assert(isServiceRoleRequest(new Request("http://x", { headers: { Authorization: `Bearer ${NEW_KEY}` } })));
  assertFalse(isServiceRoleRequest(new Request("http://x", { headers: { Authorization: "Bearer anon-key-anon-key-anon-key" } })));
  assertFalse(isServiceRoleRequest(new Request("http://x")));
});

Deno.test("accepts a server key in the apikey header and any key from SUPABASE_SECRET_KEYS", () => {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", NEW_KEY);
  Deno.env.set("SUPABASE_SECRET_KEYS", JSON.stringify({ default: OTHER_SECRET }));
  assert(isServiceRoleRequest(new Request("http://x", { headers: { apikey: NEW_KEY, Authorization: "Bearer user-jwt" } })));
  assert(isServiceRoleRequest(new Request("http://x", { headers: { Authorization: `Bearer ${OTHER_SECRET}` } })));
  assertFalse(isServiceRoleRequest(new Request("http://x", { headers: { apikey: "sb_publishable_not-a-server-key" } })));
  Deno.env.delete("SUPABASE_SECRET_KEYS");
});
