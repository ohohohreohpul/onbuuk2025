// Tools the AI receptionist can call. Every tool validates its input, works
// only on this shop's data and returns { error } instead of throwing, so the
// model can recover. Changes (book, cancel, move) need the customer's explicit
// yes, double-checked by TypeSafe Jev when configured.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  cancelBooking, createBookingFromHold, createHold, getAvailableSlots, logAgentEvent, recordAgentBooking,
} from "../agentBooking.ts";
import { freeSlots, type DirectBusiness } from "../directBooking.ts";
import { notifyMerchantOfAgentBooking } from "../agentNotify.ts";
import { AGENT_CONFIDENCE_THRESHOLD, checkCustomerAgreement, isTypesafeConfigured } from "../typesafe.ts";
import type { ToolSchema } from "./llm.ts";
import type { CatalogEntry, ShopContext, StaffEntry } from "./shopContext.ts";
import { formatEuro, type Channel } from "./prompt.ts";
import { phoneTailPattern, withinLimit } from "./limits.ts";

const MAX_TIMES_RETURNED = 12;
const MAX_GIFT_LOOKUPS_PER_CONVERSATION = 5;
const MAX_GIFT_LOOKUPS_PER_SHOP = 30;
const MAX_VOUCHER_LINKS_PER_CONVERSATION = 5;
const CENTS_PER_EURO = 100;
const HOUR_SECONDS = 3600;
const MEMORY_LIMIT = 600;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+\d][\d\s()/-]{5,24}$/;

export interface ToolConversation {
  id: string;
  channel: Channel;
  contactName: string | null;
  contactEmail: string | null; // verified on the email channel
  contactPhone: string | null; // verified on the WhatsApp channel
  /** Whether the contact's identity is proven for this message (see Inbound.isVerifiedSender). */
  isVerified: boolean;
}

export interface ToolOutcome {
  handedOver: { reason: string } | null;
  optOut: boolean;
  memory: string | null;
  contact: { name?: string; email?: string; phone?: string };
  actions: { tool: string; result: string; bookingId?: string }[];
}

export interface ToolRun {
  supabase: SupabaseClient;
  shop: ShopContext;
  conversation: ToolConversation;
  /** Last messages as "Customer: …" / "Assistant: …" lines, for the Jev agreement check. */
  transcript: string;
  outcome: ToolOutcome;
}

export function newOutcome(): ToolOutcome {
  return { handedOver: null, optOut: false, memory: null, contact: {}, actions: [] };
}

const str = { type: "string" } as const;

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "find_free_times",
      description: "Free start times for one treatment on one day. Always call before naming times.",
      parameters: {
        type: "object",
        properties: { treatment: { ...str, description: "Treatment ref, e.g. d3" }, date: { ...str, description: "YYYY-MM-DD" }, therapist: { ...str, description: "Optional therapist ref, e.g. t2" } },
        required: ["treatment", "date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description: "Books a time returned by find_free_times. Only after the customer explicitly agreed to the full summary.",
      parameters: {
        type: "object",
        properties: {
          treatment: str, date: str, time: { ...str, description: "HH:MM" }, therapist: { ...str, description: "Optional therapist ref" },
          name: str, email: str, phone: str,
          voucher_code: { ...str, description: "Optional voucher code the customer wants to use" },
          note: { ...str, description: "Optional short note for the shop (wishes, pressure, allergies)" },
          customer_confirmed: { type: "boolean", description: "true only if the customer's last message clearly said yes to this exact booking" },
        },
        required: ["treatment", "date", "time", "name", "email", "phone", "customer_confirmed"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_my_bookings",
      description: "Upcoming bookings of the verified customer (email or WhatsApp channel only).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_booking",
      description: "Cancels one booking from find_my_bookings after the customer clearly confirmed.",
      parameters: { type: "object", properties: { booking: { ...str, description: "Booking ref from find_my_bookings" }, customer_confirmed: { type: "boolean" } }, required: ["booking", "customer_confirmed"] },
    },
  },
  {
    type: "function",
    function: {
      name: "move_booking",
      description: "Moves one booking from find_my_bookings to a new free time (from find_free_times) after the customer clearly confirmed.",
      parameters: {
        type: "object",
        properties: { booking: str, date: str, time: str, therapist: str, customer_confirmed: { type: "boolean" } },
        required: ["booking", "date", "time", "customer_confirmed"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_gift_card",
      description: "Balance and validity of a voucher code the customer gave you.",
      parameters: { type: "object", properties: { code: str }, required: ["code"] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_voucher_payment_link",
      description: "Creates a personal payment link for a digital voucher the customer agreed to buy. Opens the shop's voucher page with everything filled in; they pay online and get the voucher by email.",
      parameters: {
        type: "object",
        properties: {
          voucher: { type: "string", description: "'value' for a value voucher, or a voucher ref like v1 from SHOP DATA" },
          amount_euros: { type: "number", description: "Only for 'value': the amount in euros" },
          buyer_name: str, buyer_email: str,
          recipient_email: { type: "string", description: "Optional: send the voucher to this person" },
          message: { type: "string", description: "Optional personal message on the voucher" },
        },
        required: ["voucher", "buyer_name", "buyer_email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "hand_over_to_staff",
      description: "Flags the conversation for a team member (complaints, refunds, health questions, anything unsure).",
      parameters: { type: "object", properties: { reason: str }, required: ["reason"] },
    },
  },
  {
    type: "function",
    function: {
      name: "stop_promotional_messages",
      description: "The customer does not want promotional WhatsApp messages any more. Call it whenever they say so in any words.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "remember_about_customer",
      description: "Stores lasting facts about the customer (replaces the previous note, so include earlier facts).",
      parameters: { type: "object", properties: { note: str }, required: ["note"] },
    },
  },
];

type Args = Record<string, unknown>;
type Result = Record<string, unknown>;

const text = (value: unknown, max = 200) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const digits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

function treatmentByRef(shop: ShopContext, ref: unknown): CatalogEntry | null {
  return shop.catalog.find((c) => c.ref === text(ref, 10)) ?? null;
}

function staffByRef(shop: ShopContext, ref: unknown): StaffEntry | null | undefined {
  const value = text(ref, 10);
  if (!value || !shop.allowStaffChoice) return undefined; // not asked for, or the shop assigns staff itself
  return shop.staff.find((s) => s.ref === value) ?? null;
}

function directBusiness(shop: ShopContext): DirectBusiness {
  return {
    id: shop.businessId, name: shop.name, address_line: shop.address, city: null,
    agent_consent_policy: shop.consentPolicy, agent_lead_time_minutes: shop.leadTimeMinutes, agent_slot_hold_seconds: shop.holdSeconds,
  };
}

/** Free start times, optionally for one therapist: [{ time, specialistId }]. */
async function freeTimes(run: ToolRun, entry: CatalogEntry, date: string, therapist: StaffEntry | undefined) {
  const duration = { id: entry.durationId, duration_minutes: entry.minutes, price_cents: entry.priceCents, service: { id: entry.serviceId, name: entry.serviceName } };
  if (!therapist) return freeSlots(run.supabase, directBusiness(run.shop), duration, date);
  const slots = await getAvailableSlots(run.supabase, {
    businessId: run.shop.businessId, serviceId: entry.serviceId, durationMinutes: entry.minutes, specialistId: therapist.id, date,
  });
  return slots.map((s) => ({ ...s, specialistId: therapist.id }));
}

/**
 * Second opinion before changing anything. New bookings fall back to the
 * customer_confirmed flag without TypeSafe; cancel/move fail closed (strict).
 */
async function confirmWithJev(run: ToolRun, proposal: string, isStrict = false): Promise<string | null> {
  if (!isTypesafeConfigured()) return isStrict ? "Changes to existing bookings need the team. Hand over." : null;
  try {
    const { agreed, confidence } = await checkCustomerAgreement(run.transcript, proposal);
    if (agreed && confidence >= AGENT_CONFIDENCE_THRESHOLD) return null;
    return "The customer has not clearly confirmed this yet. Repeat the exact details and ask for a clear yes.";
  } catch (error) {
    console.error("Jev agreement check failed:", error);
    return isStrict ? "Could not double-check the confirmation. Hand over to the team." : null;
  }
}

/** Therapist name for the customer – hidden when the shop assigns staff itself. */
const staffName = (shop: ShopContext, id: string) => (shop.allowStaffChoice ? shop.staff.find((s) => s.id === id)?.name ?? null : null);

async function findFreeTimes(run: ToolRun, args: Args): Promise<Result> {
  const entry = treatmentByRef(run.shop, args.treatment);
  const date = text(args.date, 10);
  if (!entry) return { error: "Unknown treatment ref. Use a ref from SHOP DATA." };
  if (!DATE.test(date)) return { error: "date must be YYYY-MM-DD" };
  if (entry.isPair) return { error: "Couple treatments are booked online or by the team. Offer the online booking link or hand over." };
  const therapist = staffByRef(run.shop, args.therapist);
  if (therapist === null) return { error: "Unknown therapist ref." };
  const slots = await freeTimes(run, entry, date, therapist);
  return {
    date, treatment: `${entry.serviceName} ${entry.minutes} min`,
    free_times: slots.slice(0, MAX_TIMES_RETURNED).map((s) => ({ time: s.time, therapist: staffName(run.shop, s.specialistId) })),
    more_available: slots.length > MAX_TIMES_RETURNED,
  };
}

async function bookAppointment(run: ToolRun, args: Args): Promise<Result> {
  const entry = treatmentByRef(run.shop, args.treatment);
  const date = text(args.date, 10);
  const time = text(args.time, 5);
  const name = text(args.name, 120);
  const email = text(args.email, 254).toLowerCase();
  const phone = text(args.phone, 40);
  if (!entry) return { error: "Unknown treatment ref." };
  if (entry.isPair) return { error: "Couple treatments cannot be booked here." };
  if (!DATE.test(date) || !TIME.test(time)) return { error: "date must be YYYY-MM-DD and time HH:MM" };
  if (name.length < 2) return { error: "Ask for the customer's full name." };
  if (!EMAIL.test(email)) return { error: "Ask for a valid email address (the confirmation is sent there)." };
  if (!PHONE.test(phone)) return { error: "Ask for a valid phone number." };
  if (args.customer_confirmed !== true) return { error: "Repeat the summary and ask the customer for a clear yes first." };
  const therapist = staffByRef(run.shop, args.therapist);
  if (therapist === null) return { error: "Unknown therapist ref." };

  const slot = (await freeTimes(run, entry, date, therapist)).find((s) => s.time === time);
  if (!slot) return { error: `${time} on ${date} is no longer free. Call find_free_times and offer other times.` };

  const proposal = `Book ${entry.serviceName} (${entry.minutes} min, ${formatEuro(entry.priceCents)}) on ${date} at ${time}${therapist ? ` with ${therapist.name}` : ""} for ${name}`;
  const notConfirmed = await confirmWithJev(run, proposal);
  if (notConfirmed) return { error: notConfirmed };

  // The code is only noted for the team; it is checked and redeemed at payment in the shop.
  const voucherCode = text(args.voucher_code, 40).toUpperCase().replace(/[^A-Z0-9-]/g, "");

  const agentName = `Zenno AI receptionist (${run.conversation.channel})`;
  const hold = await createHold(run.supabase, {
    businessId: run.shop.businessId, serviceId: entry.serviceId, durationId: entry.durationId, specialistId: slot.specialistId,
    date, startTime: time, holdSeconds: run.shop.holdSeconds, agentKeyId: null, customerEmail: email, customerName: name, customerPhone: phone,
  });
  const notes = [
    `Booked by the AI receptionist (${run.conversation.channel}).`,
    text(args.note, 300),
    voucherCode ? `Customer wants to use voucher ${voucherCode}.` : "",
  ].filter(Boolean).join(" ");
  const booking = await createBookingFromHold(run.supabase, {
    businessId: run.shop.businessId, holdId: hold.id, consentPolicy: run.shop.consentPolicy, notes, aiAgent: agentName,
  });
  const { approvalToken } = await recordAgentBooking(run.supabase, {
    businessId: run.shop.businessId, bookingId: booking.id, agentKeyId: null, agentName, confidence: 1, source: `receptionist:${run.conversation.channel}`,
  });
  await notifyMerchantOfAgentBooking(run.supabase, { businessId: run.shop.businessId, bookingId: booking.id, status: booking.status, approvalToken, agentName });
  await logAgentEvent(run.supabase, {
    businessId: run.shop.businessId, agentKeyId: null, action: "receptionist_book", result: booking.status,
    payload: { conversationId: run.conversation.id, bookingId: booking.id },
  });

  run.outcome.contact = { name, email, phone };
  run.outcome.actions.push({ tool: "book_appointment", result: booking.status, bookingId: booking.id });
  return {
    booked: true,
    status: booking.status === "confirmed" ? "confirmed" : "request sent — the shop confirms it",
    treatment: `${entry.serviceName} ${entry.minutes} min`, price: formatEuro(entry.priceCents),
    date, time, therapist: staffName(run.shop, slot.specialistId),
    confirmation_email: `sent to ${email}`,
    voucher: voucherCode ? "noted – it is checked and applied when paying in the shop" : null,
  };
}

interface OwnBooking {
  id: string;
  booking_date: string;
  start_time: string;
  status: string;
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  duration_id: string;
  specialist_id: string | null;
  services: { name: string } | null;
}

/** Upcoming bookings that belong to the verified contact of this conversation. */
async function ownBookings(run: ToolRun): Promise<OwnBooking[] | { error: string }> {
  const { channel, contactEmail, contactPhone, isVerified } = run.conversation;
  if (channel === "web" || !isVerified) {
    return { error: "This customer is not verified on this channel. Point them to the cancel/change link in their confirmation email, or hand over to the team." };
  }
  const today = new Date().toISOString().slice(0, 10);
  let query = run.supabase.from("bookings")
    .select("id, booking_date, start_time, status, customer_email, customer_name, customer_phone, duration_id, specialist_id, services(name)")
    .eq("business_id", run.shop.businessId).gte("booking_date", today).neq("status", "cancelled").order("booking_date").limit(20);
  if (channel === "email") {
    const email = (contactEmail ?? "").toLowerCase();
    if (!email || /[*,()\\]/.test(email)) return [];
    query = query.ilike("customer_email", email.replace(/[%_]/g, (c) => `\\${c}`));
  } else {
    const pattern = phoneTailPattern(contactPhone);
    if (!pattern) return [];
    query = query.ilike("customer_phone", pattern);
  }
  const { data, error } = await query;
  if (error) return { error: "Could not look up bookings right now." };
  const rows = (data ?? []) as unknown as OwnBooking[];
  // Exact check after the SQL filter (the pattern also matches longer numbers).
  if (channel === "whatsapp") {
    const tail = (contactPhone ?? "").replace(/\D/g, "").slice(-9);
    return rows.filter((b) => (b.customer_phone ?? "").replace(/\D/g, "").endsWith(tail));
  }
  return rows.filter((b) => b.customer_email.toLowerCase() === (contactEmail ?? "").toLowerCase());
}

const bookingRef = (id: string) => id.slice(0, 8);

async function findMyBookings(run: ToolRun): Promise<Result> {
  const result = await ownBookings(run);
  if ("error" in result) return result;
  return {
    bookings: result.map((b) => ({
      booking: bookingRef(b.id), date: b.booking_date, time: b.start_time.slice(0, 5),
      treatment: b.services?.name ?? null, therapist: b.specialist_id ? staffName(run.shop, b.specialist_id) : null, status: b.status,
    })),
  };
}

async function resolveOwnBooking(run: ToolRun, ref: unknown): Promise<OwnBooking | { error: string }> {
  const result = await ownBookings(run);
  if ("error" in result) return result;
  const match = result.find((b) => bookingRef(b.id) === text(ref, 12));
  return match ?? { error: "Unknown booking ref. Call find_my_bookings first." };
}

async function cancelOwnBooking(run: ToolRun, args: Args): Promise<Result> {
  if (args.customer_confirmed !== true) return { error: "Ask the customer to confirm the cancellation first." };
  const booking = await resolveOwnBooking(run, args.booking);
  if ("error" in booking) return booking;
  const notConfirmed = await confirmWithJev(run, `Cancel the booking on ${booking.booking_date} at ${booking.start_time.slice(0, 5)} (${booking.services?.name ?? "treatment"})`, true);
  if (notConfirmed) return { error: notConfirmed };
  await cancelBooking(run.supabase, { businessId: run.shop.businessId, bookingId: booking.id, customerEmail: booking.customer_email });
  await logAgentEvent(run.supabase, {
    businessId: run.shop.businessId, agentKeyId: null, action: "receptionist_cancel", result: "cancelled",
    payload: { conversationId: run.conversation.id, bookingId: booking.id },
  });
  run.outcome.actions.push({ tool: "cancel_booking", result: "cancelled", bookingId: booking.id });
  return { cancelled: true, date: booking.booking_date, time: booking.start_time.slice(0, 5) };
}

async function moveOwnBooking(run: ToolRun, args: Args): Promise<Result> {
  if (args.customer_confirmed !== true) return { error: "Ask the customer to confirm the new time first." };
  const booking = await resolveOwnBooking(run, args.booking);
  if ("error" in booking) return booking;
  const entry = run.shop.catalog.find((c) => c.durationId === booking.duration_id);
  if (!entry) return { error: "This booking's treatment is no longer offered. Hand over." };
  const date = text(args.date, 10);
  const time = text(args.time, 5);
  if (!DATE.test(date) || !TIME.test(time)) return { error: "date must be YYYY-MM-DD and time HH:MM" };
  const therapist = staffByRef(run.shop, args.therapist);
  if (therapist === null) return { error: "Unknown therapist ref." };
  const slot = (await freeTimes(run, entry, date, therapist)).find((s) => s.time === time);
  if (!slot) return { error: `${time} on ${date} is not free. Call find_free_times.` };
  if (run.shop.consentPolicy === "manual") return { error: "This shop confirms every booking itself, so moving needs the team. Hand over." };
  const notConfirmed = await confirmWithJev(run, `Move the ${booking.booking_date} ${booking.start_time.slice(0, 5)} booking to ${date} at ${time}`, true);
  if (notConfirmed) return { error: notConfirmed };

  // New booking first, old one cancelled after: the customer never ends up with nothing.
  const agentName = `Zenno AI receptionist (${run.conversation.channel})`;
  const hold = await createHold(run.supabase, {
    businessId: run.shop.businessId, serviceId: entry.serviceId, durationId: entry.durationId, specialistId: slot.specialistId,
    date, startTime: time, holdSeconds: run.shop.holdSeconds, agentKeyId: null,
    customerEmail: booking.customer_email, customerName: booking.customer_name ?? undefined, customerPhone: booking.customer_phone ?? undefined,
  });
  const moved = await createBookingFromHold(run.supabase, {
    businessId: run.shop.businessId, holdId: hold.id, consentPolicy: run.shop.consentPolicy,
    notes: `Moved by the AI receptionist from ${booking.booking_date} ${booking.start_time.slice(0, 5)}.`, aiAgent: agentName,
  });
  try {
    if (moved.status !== "confirmed") throw new Error(`new booking is ${moved.status}`);
    await cancelBooking(run.supabase, { businessId: run.shop.businessId, bookingId: booking.id, customerEmail: booking.customer_email });
  } catch (error) {
    console.error("move: old booking not cancelled", error);
    run.outcome.handedOver = { reason: `Moved to ${date} ${time}, but the old booking (${booking.booking_date} ${booking.start_time.slice(0, 5)}) is still there – please cancel it` };
  }
  const { approvalToken } = await recordAgentBooking(run.supabase, {
    businessId: run.shop.businessId, bookingId: moved.id, agentKeyId: null, agentName, confidence: 1, source: `receptionist:${run.conversation.channel}:move`,
  });
  await notifyMerchantOfAgentBooking(run.supabase, { businessId: run.shop.businessId, bookingId: moved.id, status: moved.status, approvalToken, agentName });
  await logAgentEvent(run.supabase, {
    businessId: run.shop.businessId, agentKeyId: null, action: "receptionist_move", result: moved.status,
    payload: { conversationId: run.conversation.id, from: booking.id, to: moved.id },
  });
  run.outcome.actions.push({ tool: "move_booking", result: moved.status, bookingId: moved.id });
  return { moved: true, date, time, therapist: staffName(run.shop, slot.specialistId), status: moved.status };
}

async function checkGiftCard(run: ToolRun, args: Args): Promise<Result> {
  const code = text(args.code, 40).toUpperCase().replace(/\s+/g, "");
  if (code.length < 4) return { error: "Ask for the full voucher code." };
  if (!run.conversation.isVerified) {
    return { error: "Voucher balances are not shown in this chat. The customer can check it when paying in the shop or enter the code on the booking page." };
  }
  const [perConversation, perShop] = await Promise.all([
    withinLimit(run.supabase, `gift:${run.conversation.id}`, HOUR_SECONDS, MAX_GIFT_LOOKUPS_PER_CONVERSATION),
    withinLimit(run.supabase, `gift-shop:${run.shop.businessId}`, HOUR_SECONDS, MAX_GIFT_LOOKUPS_PER_SHOP),
  ]);
  if (!perConversation || !perShop) return { error: "Too many voucher checks. Hand over to the team." };
  const { data } = await run.supabase.from("gift_cards")
    .select("card_type, current_balance_cents, remaining_visits, status, expires_at")
    .eq("business_id", run.shop.businessId).eq("code", code).maybeSingle();
  await logAgentEvent(run.supabase, {
    businessId: run.shop.businessId, agentKeyId: null, action: "receptionist_gift_lookup", result: data ? "found" : "not_found",
    payload: { conversationId: run.conversation.id },
  });
  if (!data) return { found: false };
  return {
    found: true, type: data.card_type, status: data.status, expires_at: data.expires_at,
    balance: data.card_type === "service_pass" ? `${data.remaining_visits ?? 0} visits left` : formatEuro(data.current_balance_cents ?? 0),
  };
}

/** Which voucher the customer wants, as a draft row; or an error the model can act on. */
export function voucherChoice(shop: ShopContext, args: Args): { kind: "value" | "pass"; amount_cents?: number; pass_offer_id?: string; label: string } | { error: string } {
  const choice = text(args.voucher, 10).toLowerCase();
  if (choice === "value") {
    if (!shop.giftCards.enabled) return { error: "This shop sells no value vouchers. Offer the vouchers listed in SHOP DATA." };
    const cents = Math.round(Number(args.amount_euros) * CENTS_PER_EURO);
    const { presetCents, customMinCents, customMaxCents } = shop.giftCards;
    const isPreset = presetCents.includes(cents);
    const isCustom = customMinCents !== null && cents >= customMinCents && cents <= (customMaxCents ?? 0);
    if (!Number.isFinite(cents) || cents <= 0 || (!isPreset && !isCustom)) {
      return { error: "That amount is not available. Offer an amount listed in SHOP DATA." };
    }
    return { kind: "value", amount_cents: cents, label: `Wertgutschein ${formatEuro(cents)}` };
  }
  const index = /^v(\d+)$/.exec(choice);
  const voucher = index ? shop.vouchers[Number(index[1]) - 1] : undefined;
  if (!voucher?.id || !voucher.kind) return { error: "Unknown voucher. Use 'value' or a ref like v1 from SHOP DATA." };
  // Sets are ordered and paid in the shop on the voucher page; only value vouchers and cards are paid online.
  if (voucher.kind === "set") return { error: `This set cannot be paid online. Send its link instead: ${voucher.url}` };
  return { kind: "pass", pass_offer_id: voucher.id, label: `${voucher.name} (${formatEuro(voucher.priceCents)})` };
}

async function createVoucherPaymentLink(run: ToolRun, args: Args): Promise<Result> {
  const { shop } = run;
  if (!shop.shopUrl) return { error: "The shop has no voucher page. Hand over to the team." };
  if (!shop.giftCards.onlinePayment) {
    return { error: `Online payment is not set up. Send the voucher page instead: ${shop.shopUrl}/?gutschein=1` };
  }
  const buyerName = text(args.buyer_name, 120);
  const buyerEmail = text(args.buyer_email, 200).toLowerCase();
  const recipientEmail = text(args.recipient_email, 200).toLowerCase() || null;
  if (!buyerName) return { error: "Ask for the buyer's full name." };
  if (!EMAIL.test(buyerEmail)) return { error: "Ask for a valid email address of the buyer." };
  if (recipientEmail && !EMAIL.test(recipientEmail)) return { error: "The recipient's email address looks wrong. Ask again or leave it out." };
  const choice = voucherChoice(shop, args);
  if ("error" in choice) return choice;
  if (!(await withinLimit(run.supabase, `voucher-link:${run.conversation.id}`, HOUR_SECONDS, MAX_VOUCHER_LINKS_PER_CONVERSATION))) {
    return { error: "Too many payment links in this chat. Hand over to the team." };
  }

  const { label, ...voucher } = choice;
  const { data, error } = await run.supabase.from("gift_card_checkout_drafts").insert({
    business_id: shop.businessId, ...voucher, buyer_name: buyerName, buyer_email: buyerEmail,
    recipient_email: recipientEmail, message: text(args.message, 500) || null, conversation_id: run.conversation.id,
  }).select("id").single();
  if (error || !data) throw new Error(`voucher draft failed: ${error?.message}`);
  await logAgentEvent(run.supabase, {
    businessId: shop.businessId, agentKeyId: null, action: "receptionist_voucher_link", result: "created",
    payload: { conversationId: run.conversation.id, kind: voucher.kind },
  });
  return {
    payment_link: `${shop.shopUrl}/?gutschein=1&kasse=${data.id}`,
    voucher: label,
    tell_customer: "Give them this link to pay online. Everything is filled in; after payment the voucher arrives by email as a PDF. The link works for 3 days.",
  };
}

export async function runTool(run: ToolRun, name: string, args: Args): Promise<Result> {
  try {
    switch (name) {
      case "find_free_times": return await findFreeTimes(run, args);
      case "book_appointment": return await bookAppointment(run, args);
      case "find_my_bookings": return await findMyBookings(run);
      case "cancel_booking": return await cancelOwnBooking(run, args);
      case "move_booking": return await moveOwnBooking(run, args);
      case "check_gift_card": return await checkGiftCard(run, args);
      case "create_voucher_payment_link": return await createVoucherPaymentLink(run, args);
      case "hand_over_to_staff": {
        run.outcome.handedOver = { reason: text(args.reason, 300) || "Needs a team member" };
        return { handed_over: true, tell_customer: "A team member will get back to them personally." };
      }
      case "stop_promotional_messages": {
        run.outcome.optOut = true;
        return { done: true, tell_customer: "They will not receive promotional messages any more." };
      }
      case "remember_about_customer": {
        run.outcome.memory = text(args.note, MEMORY_LIMIT);
        return { saved: true };
      }
      default: return { error: `Unknown tool ${name}` };
    }
  } catch (error) {
    console.error(`receptionist tool ${name} failed:`, error);
    return { error: "That did not work. Try once more or hand over to the team." };
  }
}
