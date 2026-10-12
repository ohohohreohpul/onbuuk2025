import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { fillTemplate, renderBuiltIn } from "./bookingEmailTemplates.ts";

const VARS = {
  customer_name: "Anna",
  service_name: "Thai Massage",
  service_duration: "60 Minuten",
  booking_date: "Montag, 19. Oktober 2026",
  booking_time: "10:00",
  booking_end_time: "11:00",
  service_price: "65,00 €",
  business_name: "SATUUU99",
  cancellation_link: "https://app.onbuuk.com/satuuu99/cancel?id=1",
  booking_status: "bestätigt",
  admin_link: "https://app.onbuuk.com/admin",
};

Deno.test("German confirmation fills subject and body", () => {
  const { subject, html } = renderBuiltIn("booking_confirmation", "de", VARS);
  assertEquals(subject, "Terminbestätigung: Thai Massage am Montag, 19. Oktober 2026");
  assertStringIncludes(html, "Hallo Anna");
  assertStringIncludes(html, "10:00 – 11:00 Uhr");
  assertStringIncludes(html, "https://app.onbuuk.com/satuuu99/cancel?id=1");
});

Deno.test("owner email links to the admin, not to the customer cancel page", () => {
  const { html } = renderBuiltIn("owner_new_booking", "de", VARS);
  assertStringIncludes(html, "https://app.onbuuk.com/admin");
  assert(!html.includes("/cancel?id="));
});

Deno.test("unknown placeholders become empty, no {{ }} left behind", () => {
  const { html } = renderBuiltIn("booking_reminder", "en", { customer_name: "Anna" });
  assert(!html.includes("{{"));
  assertEquals(fillTemplate("Hi {{nobody}}!", {}), "Hi !");
});
