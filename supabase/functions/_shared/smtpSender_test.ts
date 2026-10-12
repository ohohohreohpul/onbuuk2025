import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { formatSender, smtpConnection } from "./smtpSender.ts";

const STRATO = {
  smtp_host: "smtp.strato.de",
  smtp_port: 465,
  smtp_username: "info@satuuu99.de",
  smtp_password: "secret",
  from_email: "info@satuuu99.de",
};

Deno.test("Strato settings give an implicit-TLS connection on 465", () => {
  assertEquals(smtpConnection(STRATO), {
    hostname: "smtp.strato.de",
    port: 465,
    tls: true,
    auth: { username: "info@satuuu99.de", password: "secret" },
  });
});

Deno.test("a missing port defaults to 465", () => {
  assertEquals(smtpConnection({ ...STRATO, smtp_port: null }).port, 465);
});

Deno.test("ports blocked by Supabase are rejected with a clear message", () => {
  assertThrows(() => smtpConnection({ ...STRATO, smtp_port: 587 }), Error, "Use port 465");
  assertThrows(() => smtpConnection({ ...STRATO, smtp_port: 25 }), Error, "Use port 465");
});

Deno.test("incomplete settings are rejected", () => {
  assertThrows(() => smtpConnection({ ...STRATO, smtp_password: "" }), Error, "password");
  assertThrows(() => smtpConnection({ ...STRATO, smtp_host: " " }), Error, "server");
});

Deno.test("sender name is quoted and cannot break the header", () => {
  assertEquals(formatSender("info@satuuu99.de", "SATUUU99, Massage"), '"SATUUU99, Massage" <info@satuuu99.de>');
  assertEquals(formatSender("info@satuuu99.de", 'Evil"\r\nBcc: x@y'), '"EvilBcc: x@y" <info@satuuu99.de>');
  assertEquals(formatSender("info@satuuu99.de", null), "info@satuuu99.de");
});
