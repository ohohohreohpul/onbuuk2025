#!/usr/bin/env node
// Live end-to-end test of the Zenno agent booking API against the
// internal test business (supabase/seed/agent_e2e_test_business.sql).
//
//   node --env-file=.env --env-file=.env.local scripts/agent-e2e.mjs
//
// Needs VITE_SUPABASE_URL and ZENNO_TEST_AGENT_KEY. Creates one booking on the
// internal test business and cancels it again.

const BASE = `${process.env.VITE_SUPABASE_URL}/functions/v1`;
const KEY = process.env.ZENNO_TEST_AGENT_KEY;
const PERMALINK = "agent-e2e-lab";
const DAYS_AHEAD = 2;
const CUSTOMER = { customerEmail: "e2e@zenno.invalid", customerName: "E2E Test", customerPhone: "+49000000" };

const results = [];

function record(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail ? ` — ${detail}` : ""}`);
}

async function call(path, { method = "POST", body, withKey = true } = {}) {
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  const headers = { "Content-Type": "application/json", apikey: anon, Authorization: `Bearer ${anon}` };
  if (withKey) headers["X-Agent-Key"] = KEY;
  const res = await fetch(`${BASE}/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

function isoDate(daysAhead) {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  return d.toISOString().slice(0, 10);
}

async function main() {
  if (!process.env.VITE_SUPABASE_URL || !KEY) throw new Error("VITE_SUPABASE_URL and ZENNO_TEST_AGENT_KEY must be set");

  const manifest = await call(`agent-manifest?permalink=${PERMALINK}`, { method: "GET", withKey: false });
  const m = manifest.json;
  const service = m.services?.[0] ?? m.business?.services?.[0];
  const duration = service?.durations?.[0] ?? m.durations?.[0];
  const specialist = m.specialists?.[0];
  record("manifest", manifest.status === 200 && Boolean(service && duration && specialist), `HTTP ${manifest.status}`);
  if (!service || !duration || !specialist) {
    console.log(JSON.stringify(m, null, 2).slice(0, 1500));
    return;
  }

  const date = isoDate(DAYS_AHEAD);
  const avail = await call("agent-availability", {
    body: { serviceId: service.id, durationMinutes: duration.minutes ?? duration.duration_minutes, specialistId: specialist.id, date },
  });
  const slot = avail.json.slots?.[0];
  record("availability", avail.status === 200 && Boolean(slot), `${avail.json.slots?.length ?? 0} slots on ${date}`);
  if (!slot) return;

  const startTime = slot.time ?? slot.startTime ?? slot;
  const hold = await call("agent-hold", {
    body: { serviceId: service.id, durationId: duration.id, specialistId: specialist.id, date, startTime, ...CUSTOMER },
  });
  record("hold", hold.status === 200 && Boolean(hold.json.holdId), `holdId ${hold.json.holdId ?? "-"}`);
  if (!hold.json.holdId) return;

  const vague = await call("agent-book", {
    body: { holdId: hold.json.holdId, request: "hmm not sure, what's the weather like on Tuesday?" },
  });
  record("Jev gate blocks unclear request", vague.status === 409 && vague.json.needsConfirmation === true,
    `HTTP ${vague.status}, reason ${vague.json.reason ?? "-"}`);

  const book = await call("agent-book", {
    body: { holdId: hold.json.holdId, confirm: true, request: "Yes, please book that haircut for me." },
  });
  record("book (confirmed, auto policy)", book.status === 200 && book.json.status === "confirmed",
    `status ${book.json.status ?? book.json.error}`);
  if (!book.json.bookingId) return;

  const cancel = await call("agent-cancel", {
    body: { bookingId: book.json.bookingId, customerEmail: CUSTOMER.customerEmail, confirm: true, request: "Please cancel my booking." },
  });
  record("cancel", cancel.status === 200, `HTTP ${cancel.status} ${cancel.json.status ?? cancel.json.error ?? ""}`);

  // Keyless AI booking (agent-direct) — what the /ai-booking form uses.
  const direct = (payload) => call("agent-direct", { body: payload, withKey: false });
  const directAvail = await direct({ action: "availability", permalink: PERMALINK, durationId: duration.id, date });
  const directSlot = directAvail.json.slots?.[0];
  record("keyless availability", directAvail.status === 200 && Boolean(directSlot), `${directAvail.json.slots?.length ?? 0} slots`);
  if (!directSlot) return;

  const directBase = { action: "book", permalink: PERMALINK, durationId: duration.id, date, time: directSlot.time,
    name: CUSTOMER.customerName, email: CUSTOMER.customerEmail, phone: CUSTOMER.customerPhone, client: "e2e-test" };
  const unconfirmed = await direct({ ...directBase, confirm: false });
  record("keyless book refuses without confirmation", unconfirmed.status === 400, `HTTP ${unconfirmed.status}`);

  const directBook = await direct({ ...directBase, confirm: true, customerRequest: "Yes please book that haircut." });
  record("keyless book", directBook.status === 200 && directBook.json.status === "confirmed", `status ${directBook.json.status ?? directBook.json.error}`);
  if (!directBook.json.bookingId) return;

  const directCancel = await call("agent-cancel", {
    body: { bookingId: directBook.json.bookingId, customerEmail: CUSTOMER.customerEmail, confirm: true, request: "Please cancel my booking." },
  });
  record("cancel keyless booking", directCancel.status === 200, `HTTP ${directCancel.status}`);
}

main()
  .catch((err) => record("run", false, err.message))
  .finally(() => {
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exitCode = failed ? 1 : 0;
  });
