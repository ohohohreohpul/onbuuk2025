# Plan: White-label email marketing for Zenno shops

**For:** Zenno developers
**Status:** feature and structure plan. The UI follows the existing Zenno admin design.
**Learned from:** Notifuse v39.1 (AGPL, so ideas only and **no code copied**) and SendPortal Core (MIT, so code may be ported if its copyright notice is kept in the ported files).

---

## 1. Goal

Shop owners send campaigns and automatic emails to **their own customers** so those customers come back.

- **Customers only ever see the shop:** the shop's name, sending address, logo, colours and Impressum. There is no Zenno branding anywhere: no "Powered by", no Zenno link domains, no Zenno sender address.
- **Built into the Zenno admin:** no second tool and no second login.
- **Zenno's advantage over Brevo:** it already knows every customer's bookings. Audiences ("hasn't been back in 60 days") and results ("this email led to 7 bookings") come from real booking data.

**Size:** 200–5,000 customers per shop. One shared sending account, with limits per shop, is enough.

## 2. What Zenno already has (reuse it)

| Already there | Use it for |
|---|---|
| `customers` per shop: email, name, total bookings, total spent, first and last visit | The contact list. **Don't create a second contact table.** Add the fields listed in section 5. |
| `business_email_templates`, `business_email_settings`, `business_email_logs` | Booking emails stay as they are. Marketing gets its own tables, because the legal rules differ. |
| `private.notification_outbox` + `process-notifications` edge function + pg_cron every minute | The same pattern drives the send queue and automations. |
| Sending via the shop's own mailbox (`_shared/smtpSender.ts`) | Stays for booking emails. **Not suitable for campaigns:** daily limits and spam risk (see 4.1). |
| Shop branding (logo and colours from the booking-page settings) | Automatic design for marketing emails. |
| Booking sources / attribution (`src/lib/attribution.ts`) | Counting bookings that came from an email. |

## 3. v1 features (what owners see)

### 3.1 Email setup ("Absender einrichten")
- **Sender name and reply-to address.**
- **Connect your own domain:**
  - The owner enters a domain, e.g. `sabai-massage.de`.
  - Zenno shows 3–4 DNS records to copy (DKIM, SPF, a return-path for bounces, and a DMARC recommendation).
  - A **"Prüfen"** button checks them and shows the status: not set up / checking / ready.
- **Without its own domain:** a neutral sending domain with **no Zenno name in it** (e.g. `sabai@<neutral-domain>`). We need to register this neutral domain.
- **Footer:** the shop's address and Impressum link are required; there is no Zenno text.

### 3.2 Consent
- **Booking form:** an unticked checkbox, "Ja, ich möchte Neuigkeiten und Angebote von <Shop> per E-Mail erhalten", which leads to double opt-in (3.6).
- **Existing customers (§7(3) UWG):** the shop may email its own customers about **similar services** without opt-in, if:
  - the customer was told about this when they gave their email address,
  - they didn't object, and
  - every email offers an unsubscribe.
  - The booking form needs the short notice text. Mark these customers as `existing_customer`, never as `opted_in`.
- **Importing a list:** the owner must confirm they have consent. Imported contacts start as `pending` and receive a double opt-in email, unless the owner explicitly chooses the existing-customer basis.
- **Customer detail in the admin:** shows the consent status, its legal basis and its history.

### 3.3 Audiences (customer groups)
Simple rule builder: match **all** or **any** of these conditions:
- **Last visit:** more / less than X days ago, or never.
- **Number of visits:** at least / at most X.
- **Total spent:** at least / at most X €.
- **Booked a service or category:** yes / no, optionally within X days.
- **Saw a specific therapist:** yes / no.
- **Holds a voucher:** active, or expiring within X days.
- **Has a future booking:** yes / no.
- **First visit within the last X days** (new customers).
- **Birthday:** this month / in X days (needs the new birthday field).

Every audience always applies "can receive marketing", which excludes the unsubscribed, bounced and complaint statuses. Each audience shows its **live size** while being edited.

**Data format:** the rules are stored as a JSON tree (the idea comes from Notifuse's segments) and turned into one SQL query per shop at send time. v1 doesn't need precomputed segment membership.

### 3.4 Campaigns
1. Name → audience → subject + preheader → content → test email → send now or schedule (date, time, Europe/Berlin).
2. **Editor:** blocks: heading, text, image, button, voucher code, divider, social links. The shop's logo, colours and footer are filled in automatically. Output is MJML compiled to HTML.
3. **Variables:** `{{first_name}}`, `{{shop_name}}`, `{{booking_url}}`, `{{last_service}}`, `{{voucher_code}}`, `{{unsubscribe_url}}`. The unsubscribe link and footer are added automatically and cannot be removed.
4. **Status:** draft → scheduled → sending → sent. Pause, resume and cancel are available while sending.
5. **Results:**
   - sent, delivered, opened, clicked
   - unsubscribes and bounces
   - **bookings and revenue within 7 days of a click** (Zenno's advantage)
   - clicks per link
6. **Later (v2):** A/B test of the subject line (2 variants, X% test group, winner by opens after N hours).

### 3.5 Automations (ready-made, switch on and customise)
Fixed flows with editable text and timing, **no canvas builder in v1**. The engine underneath is generic (section 6), so a visual builder can come later without a rewrite.

| Automation | Trigger | Default timing |
|---|---|---|
| Welcome | Contact confirmed (opt-in) or first booking | right away |
| Review request ("Wie war's?") | Booking completed | 3 hours after the appointment ends |
| Win-back ("Wir vermissen dich") | No visit for X days | X = 60, then reminder after 14 days if no booking |
| Birthday | Birthday | 7 days before, with an optional voucher code |
| Voucher expiry | Voucher expires | 30 days before |

- **Every send goes through the marketing guard:** no consent or suppressed address means no email.
- **Exit rule:** a contact leaves an automation as soon as they book (win-back) or unsubscribe.
- **Each automation shows:** how many people are currently in it, how many emails it has sent, and how many bookings resulted.

**Review request:** it must go to all customers, not only happy ones (Google forbids filtering). Its legal basis is "transactional-like follow-up". Keep it in the marketing category anyway, so it honours unsubscribes.

### 3.6 Unsubscribe and preferences page
- **Runs on the shop's own booking host** (subdomain or custom domain) and shows the shop's branding.
- **One-click unsubscribe:**
  - Every marketing email carries the `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers (RFC 8058, required by Gmail and Yahoo for bulk senders).
  - The POST endpoint must check the `List-Unsubscribe=One-Click` body.
- **Signed links:** they carry an HMAC signature of contact and shop, with no login.
- **Unsubscribe applies per shop.** It never affects other shops or booking emails.
- **Double opt-in confirmation page:** reuses the same signed-link mechanism.

## 4. Behind the scenes (invisible to owners, essential for the product)

### 4.1 Sending provider
- **One platform account with an email provider**, either **Amazon SES** (cheapest; SendPortal and Notifuse both support it) or **Postmark** (best deliverability, more expensive). The provider must support **per-domain identities and per-message tags**, so each shop's domain is signed separately.
- **Hide the provider behind one interface,** `sendMarketingEmail(message)`, so it can be swapped later.
- **Keep transactional and marketing traffic apart:** use separate streams or configuration sets, so one bad campaign can't block booking confirmations.

### 4.2 Send queue
- **Pattern:** the same as the existing outbox. Campaign start and automation steps write rows into `email_queue`. A pg_cron job calls an edge function every minute, which takes rows with `FOR UPDATE SKIP LOCKED` in batches and sends them. Successful rows are deleted. Failures retry with backoff (`attempts`, `next_retry_at`).
- **Fairness:** round-robin across shops, so one big campaign doesn't delay other shops.
- **Rate limits:**
  - per shop (e.g. new shops get 500 per day for the first 2 weeks, then more)
  - for the whole platform, matching the provider quota
- **Circuit breaker:** pause sending after repeated provider errors.
- **Idempotency:** never create two messages for the same (campaign, contact) pair. Check this before the queue row is created. The idea is from SendPortal `CreateMessages`.

### 4.3 Tracking
- **Open pixel and click redirect** go through the **shop's booking host** (`/e/o/<token>`, `/e/c/<token>`), never a Zenno domain.
- **Tokens are encrypted or signed;** plain query parameters can be forged.
- **Opens and clicks aren't counted** for known bot user agents or within the first ~7 seconds after sending (mail scanners). Clicks on the unsubscribe link aren't counted as clicks either.
- **Clicked booking links** carry `?src=email&m=<message>`, so later bookings are attributed to that email.
- **Opens are only an estimate** (Apple Mail privacy features). The headline result is clicks and bookings.

### 4.4 Bounces and complaints
- **Provider webhooks** go to an edge function, which:
  - checks the signature,
  - stores the raw event to avoid duplicates (`email_events_inbound`),
  - updates the message,
  - updates suppression.
- **Bounce classes** (idea from Notifuse):
  - **Hard** (address doesn't exist): suppress immediately.
  - **Soft** (mailbox full, temporary): suppress after 5 in a row.
  - **Message-level** (too large, content rejected): never counts against the contact.
- **Complaint** (marked as spam): suppress immediately, everywhere in this shop.
- **Shop health:** bounce rate above 5% or complaint rate above 0.1% on a campaign automatically pauses that shop's sending and notifies Zenno.
- **Porting:** SendPortal's MIT webhook parsers for SES and Postmark can be ported to TypeScript (`HandleSesWebhook.php`, `HandlePostmarkWebhook.php`). Keep the MIT notice in the ported file. Unlike SendPortal, **always verify signatures and timestamps.**

### 4.5 Protecting all shops' reputation
- **New shops:** sending limits plus a quick Zenno review of their **first campaign**.
- **Imports:** consent confirmation is required, and the file is checked for role addresses and obviously bought lists.
- **Marketing emails:** need a verified sending domain, or use the neutral domain.

### 4.6 Legal
- **DSGVO roles:** the shop is the data controller and Zenno is the processor. Every shop accepts a **data processing agreement (AVV)** before its first marketing email.
- **Consent records:** what the customer saw, when, the source (booking form, import, admin) and the IP for opt-ins. Keep them as long as the contact exists plus 3 years.
- **Every marketing email:** shop name, postal address, Impressum link and an unsubscribe link.
- **No health promises** in Zenno's own default texts (HWG). Shops are responsible for their own texts; a hint in the editor helps.

## 5. Data model (Supabase, every table has `business_id` + RLS for the shop's admins)

**Additions to `customers`:**
- `birthday date`
- `marketing_status`: `none | pending | opted_in | existing_customer | unsubscribed | bounced | complained`
- `marketing_status_changed_at`
- `soft_bounce_count`

**New tables:**

| Table | Key fields |
|---|---|
| `marketing_consent_events` | customer_id, from_status, to_status, legal_basis, source, consent_text, ip, created_at |
| `email_suppressions` | business_id, email, reason (hard_bounce, complaint, admin, unsubscribe), created_at. Unique per shop. |
| `email_sender_domains` | business_id, domain, provider_identity_id, dns_records jsonb, status (pending, verified, failed), verified_at |
| `email_audiences` | business_id, name, rules jsonb, created_at |
| `email_templates_marketing` | business_id, name, category (campaign, automation, opt_in), subject, preheader, blocks jsonb, html, updated_at |
| `email_campaigns` | business_id, name, status, audience_id, template_id, scheduled_at, started_at, finished_at, counters (recipients, sent, delivered, opened, clicked, bounced, complained, unsubscribed, bookings, revenue_cents) |
| `email_messages` | business_id, customer_id, source_type (campaign, automation), source_id, provider_message_id, token (for links), timestamps for queued, sent, delivered, opened, clicked, bounced, complained, unsubscribed and failed, open_count, click_count, error |
| `email_message_links` | message_id or campaign_id, url, click_count |
| `email_queue` | business_id, message_id, priority, attempts, next_retry_at, payload jsonb |
| `email_automations` | business_id, kind (welcome, review, winback, birthday, voucher_expiry), status (draft, live, paused), settings jsonb (timing, texts), steps jsonb (node list, see 6) |
| `email_automation_enrollments` | automation_id, customer_id, current_step, status (active, completed, exited, failed), exit_reason, scheduled_at, entered_at, retry_count, last_error |
| `email_automation_log` | enrollment_id, step, action (entered, sent, skipped, failed), created_at |
| `email_events_inbound` | provider, event_id (unique), payload jsonb, processed_at |

## 6. Automation engine (generic, so it can grow into a builder)

Learned from Notifuse's design:

- **Automation:** a trigger plus an ordered list of **steps**. Each step has `{ id, type, config, next }`.
- **Step types in v1:** `wait` (duration, or "until X days before a date"), `send_email` (template), `check` (condition; exit or continue, e.g. "has booked since entering").
- **Later:** `branch`, `ab_test`, `add_tag`, `webhook`.
- **Triggers:** booking events, contact confirmed, and daily date checks (birthday, voucher expiry, X days without a visit).
  - **Booking events:** use database triggers on bookings, like the existing outbox.
  - **Date-based triggers:** a nightly job.
- **Enrollment:** `once` per contact (win-back may repeat after it completes), recorded so no one is enrolled twice.
- **Execution:**
  - pg_cron calls an edge function every minute.
  - It takes due enrollments (`scheduled_at <= now`, `SKIP LOCKED`, batch, round-robin across shops).
  - It runs steps until it reaches a `wait` (which sets `scheduled_at` and stops) or the end.
  - A paused automation freezes its enrollments in place.
- **Guards on every `send_email`:**
  - marketing consent is OK,
  - the address is not suppressed,
  - the shop's sending is not paused.
  - Otherwise the step is skipped with a reason in the log.

## 7. Build phases

1. **Foundation:**
   - consent fields and events, the booking-form checkbox and notice
   - double opt-in, the signed unsubscribe and preferences page
   - suppression
   - provider account, sender domain setup, neutral fallback domain
   - send queue, provider webhooks
2. **Automations:**
   - engine
   - review request and win-back first, then welcome, birthday (with a birthday field in the booking form and admin) and voucher expiry
3. **Campaigns:**
   - audiences with live size
   - block editor
   - scheduling, sending, pause and cancel
   - tracking, results with booking attribution
4. **Hardening:**
   - shop health limits and auto-pause, first-campaign review
   - import with consent check
   - AVV acceptance flow
5. **Later:**
   - A/B tests
   - visual automation builder
   - SMS / WhatsApp

## 8. Done when (per phase)

- [ ] A customer who ticks the box gets a confirmation email from the shop's domain; clicking it marks them `opted_in`. Consent events are stored.
- [ ] One-click unsubscribe works from the Gmail "Unsubscribe" button and from the footer link, and affects only that shop.
- [ ] No Zenno name in any header, link, footer or sender of a marketing email. Verify by viewing the raw source of a test email.
- [ ] A hard bounce and a spam complaint (provider test addresses) suppress the contact, and future sends skip them.
- [ ] The review-request email arrives 3 h after a completed booking. The win-back email stops for a customer who books in between.
- [ ] A campaign to 2,000 test contacts finishes without duplicates. Results show clicks, plus bookings from those clicks.
- [ ] One shop exceeding its complaint limit pauses only that shop.
- [ ] Unit tests: audience rules → SQL, consent transitions, bounce classification, step engine, link signing. Integration tests: RLS (shop A can never read shop B's contacts, campaigns or messages).

## 9. Decisions needed

1. **Provider:** Amazon SES (cheapest) or Postmark (simplest, best inbox placement)?
2. **Neutral fallback sending domain:** which name?
3. **Pricing:** included up to X emails per month, then paid packs? Provider cost is roughly €0.10–1 per 1,000 emails.
4. **Review request:** link to Google reviews, Zenno's own verified reviews (future), or both?
