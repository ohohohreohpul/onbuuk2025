# Zenno Agent API — `/agent/v1`

The universal booking layer that makes a business bookable by every AI agent.
Any AI assistant (ChatGPT, Perplexity, Siri, …) can discover a business, read
its live availability, place a slot hold, and create a booking — with consent
and confidence gating.

## Base URL

```
https://<your-supabase-project>.functions.supabase.co/agent/v1
```

Each endpoint is a separate Supabase Edge Function. Append the path below to
the Supabase functions URL, e.g. `…/functions/v1/agent-manifest`.

## Authentication

- **Public endpoint** (`agent-manifest`): no auth required.
- **Authenticated endpoints** (`availability`, `hold`, `book`, `cancel`,
  `reschedule`): send a merchant-issued API key in the `X-Agent-Key` header.

```
X-Agent-Key: za_<…>
```

Keys are issued in the merchant dashboard under **AI Agents → API keys**. The
raw key is shown once; only its SHA-256 hash is stored. Keys can be revoked at
any time. Requests are rate-limited per key (120 / minute).

## Endpoints

### `GET /agent/v1/manifest?permalink=<permalink>` — agent-readable catalog

Public. Returns the business's services, durations, specialists, working
hours, location, and booking policy — the data an agent needs to reason about
what it can book. Also available at `/{permalink}/agent.json`.

### `POST /agent/v1/availability` — live slots

Authenticated. Returns concrete available time slots for a service/duration on
a date, de-duplicated across specialists. Respects the merchant's lead-time
policy.

```json
// request
{ "serviceId": "…", "durationMinutes": 60, "specialistId": "…", "date": "2026-10-06" }

// response
{ "date": "2026-10-06", "slots": [
  { "time": "09:00", "startsAt": "2026-10-06T09:00:00", "availableSpecialists": 2 } ] }
```

### `POST /agent/v1/hold` — tentatively reserve a slot

Authenticated. Creates a time-limited hold (default 600s, merchant-configurable).
Idempotent on (specialist, date, start_time, customer_email).

```json
// request
{ "serviceId": "…", "durationId": "…", "specialistId": "…",
  "date": "2026-10-06", "startTime": "09:00",
  "customerEmail": "jane@example.com", "customerName": "Jane" }

// response
{ "holdId": "…", "heldUntil": "2026-09-30T11:10:00Z",
  "slot": { "date": "2026-10-06", "startTime": "09:00" } }
```

### `POST /agent/v1/book` — convert a hold into a booking (confidence-gated)

Authenticated. A booking is created only when **either** the caller sends
`confirm: true` **or** the optional `request` text is rated by TypeSafe as a
high-confidence booking intent. Otherwise the endpoint returns a clarification
payload and creates nothing.

```json
// request
{ "holdId": "…", "confirm": true, "request": "Book me in for Tuesday 9am" }

// success
{ "bookingId": "…", "status": "confirmed", "date": "2026-10-06",
  "startTime": "09:00", "consent": "auto",
  "message": "Booking confirmed." }

// needs confirmation
{ "needsConfirmation": true, "reason": "low_confidence_for_book",
  "confidence": 0.4,
  "message": "Booking intent is not confident enough. Re-send with confirm: true to create the booking." }
```

The `status` respects the merchant consent policy: `auto` → `confirmed`;
`manual` → `pending` (awaiting merchant confirmation in the dashboard).

### `POST /agent/v1/cancel` — cancel a booking

Authenticated. Confidence-gated like `book`. Requires the booking id and the
matching customer email.

```json
{ "bookingId": "…", "customerEmail": "jane@example.com", "confirm": true }
```

### `POST /agent/v1/reschedule` — move a booking

Authenticated. Cancels the old booking, places a hold on the new slot, and
books it in one transaction. Confidence-gated.

```json
{ "bookingId": "…", "customerEmail": "jane@example.com",
  "serviceId": "…", "durationId": "…", "specialistId": "…",
  "date": "2026-10-08", "startTime": "11:00", "confirm": true }
```

## Worked example: a full agent conversation

```bash
# 1. Read the manifest (the business page links to it)
curl $BASE/agent-manifest?permalink=studio-nord

# 2. Live availability
curl -X POST $BASE/agent-availability -H "X-Agent-Key: $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"serviceId":"…","durationMinutes":60,"date":"2026-10-06"}'

# 3. Hold the slot
curl -X POST $BASE/agent-hold -H "X-Agent-Key: $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"serviceId":"…","durationId":"…","specialistId":"…","date":"2026-10-06","startTime":"09:00","customerEmail":"jane@example.com"}'

# 4. Book it
curl -X POST $BASE/agent-book -H "X-Agent-Key: $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"holdId":"…","confirm":true}'

# 5. Cancel if needed
curl -X POST $BASE/agent-cancel -H "X-Agent-Key: $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"bookingId":"…","customerEmail":"jane@example.com","confirm":true}'
```

## Where TypeSafe fits

The optional `request` field on `book` / `cancel` / `reschedule` is evaluated
with [TypeSafe](https://docs.typesafe.ai) (Jev / System One) to rate intent
confidence. Below the threshold (0.7) the action is **not** performed and the
caller receives a clarification payload. This is the consent/reliability gate:
agents can explore freely, but irreversible actions require either high
confidence or an explicit confirmation. Set `TYPESAFE_API_KEY` server-side to
enable; when unset, mutating actions simply require `confirm: true`.

## Server-side configuration

| Env var | Where | Purpose |
| --- | --- | --- |
| `TYPESAFE_API_KEY` | Supabase Edge Function secrets | Enables TypeSafe confidence gating |
| `SUPABASE_URL` | Supabase project | Edge function backend |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project | Service-role access (RLS bypass) |

Never expose `TYPESAFE_API_KEY` or the service role key to the client.

## Reliability

- Slot holds are TTL-enforced; stale holds are expired before availability is
  returned, so two agents cannot grab the same slot.
- Every mutating call writes an `agent_events` row; every booking writes an
  `agent_bookings` row — both visible in the merchant dashboard.
- Merchant consent policy (`auto` / `manual`) controls whether agent bookings
  are confirmed instantly or held for review.
## AI booking form (on every shop domain)

The primary way AI assistants book a Zenno business: no account, no key, no JavaScript.

- **Get found:** the shop's home page ships schema.org JSON-LD (e.g. `HairSalon`, services with prices, opening hours) with a `ReserveAction` pointing at `/ai-booking`, and `/llms.txt` summarises the business and how to book.
- **`GET /ai-booking`** lists services; **`GET /ai-booking?service=<durationId>&date=YYYY-MM-DD`** shows free times and a plain HTML form. Add `?format=json` (or `Accept: application/json`) for JSON.
- **`POST /ai-booking`** (form or JSON): `durationId, date, time, specialistId?, name, email, phone, confirm, customerRequest?`. `confirm` must be true: book only after the customer agreed to the service, date and time.
- Behind it, the keyless `agent-direct` edge function applies the same rules as the rest of the API plus caps of 30 AI bookings per business and 10 attempts per client per hour, and emails both the customer (with a cancel link) and the business.

## Merchant notifications

Every agent booking emails the business owner/admins through the business's own mail settings. With the "approve each booking myself" policy, the email carries a one-tap link to `/approve-booking?token=…` on the app host; the token only previews, approves or declines that one booking.

## Live end-to-end test

`node --env-file=.env --env-file=.env.local scripts/agent-e2e.mjs` runs manifest → availability → hold → unclear-request gate → book → cancel → keyless AI booking against the internal test business (`supabase/seed/agent_e2e_test_business.sql`).
