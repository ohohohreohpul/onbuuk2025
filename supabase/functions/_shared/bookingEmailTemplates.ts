/**
 * Built-in booking emails (German / English / Thai). A shop's own enabled template in
 * email_templates (same event_key) wins for customer emails. Placeholders are
 * {{name}}; values arrive HTML-escaped from bookingEmailData.
 */
import type { EmailLanguage } from "./bookingEmailData.ts";

export type NotificationEvent =
  | "booking_received"
  | "booking_confirmation"
  | "booking_cancelled"
  | "booking_reminder"
  | "booking_rescheduled"
  | "owner_new_booking"
  | "owner_booking_cancelled";

export const OWNER_EVENTS: NotificationEvent[] = ["owner_new_booking", "owner_booking_cancelled"];

interface Template {
  subject: string;
  heading: string;
  intro: string;
  footer?: string;
}

const DETAILS = {
  de: `<table style="border-collapse:collapse;margin:16px 0;font-size:15px">
<tr><td style="padding:4px 16px 4px 0;color:#78716c">Behandlung</td><td>{{service_name}} ({{service_duration}})</td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#78716c">Datum</td><td>{{booking_date}}</td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#78716c">Uhrzeit</td><td>{{booking_time}} – {{booking_end_time}} Uhr</td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#78716c">Preis</td><td>{{service_price}}</td></tr>
</table>`,
  en: `<table style="border-collapse:collapse;margin:16px 0;font-size:15px">
<tr><td style="padding:4px 16px 4px 0;color:#78716c">Treatment</td><td>{{service_name}} ({{service_duration}})</td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#78716c">Date</td><td>{{booking_date}}</td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#78716c">Time</td><td>{{booking_time}} – {{booking_end_time}}</td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#78716c">Price</td><td>{{service_price}}</td></tr>
</table>`,
  th: `<table style="border-collapse:collapse;margin:16px 0;font-size:15px">
<tr><td style="padding:4px 16px 4px 0;color:#78716c">บริการ</td><td>{{service_name}} ({{service_duration}})</td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#78716c">วันที่</td><td>{{booking_date}}</td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#78716c">เวลา</td><td>{{booking_time}} – {{booking_end_time}} น.</td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#78716c">ราคา</td><td>{{service_price}}</td></tr>
</table>`,
};

const CUSTOMER_FOOTER = {
  de: `<p>Termin absagen: <a href="{{cancellation_link}}">{{cancellation_link}}</a></p>
<p>{{business_name}}<br>{{business_address}}<br>{{business_phone}}</p>`,
  en: `<p>Need to cancel? <a href="{{cancellation_link}}">{{cancellation_link}}</a></p>
<p>{{business_name}}<br>{{business_address}}<br>{{business_phone}}</p>`,
  th: `<p>ต้องการยกเลิกนัด? <a href="{{cancellation_link}}">{{cancellation_link}}</a></p>
<p>{{business_name}}<br>{{business_address}}<br>{{business_phone}}</p>`,
};

const OWNER_DETAILS = {
  de: `<p><strong>{{customer_name}}</strong> · {{customer_email}} · {{customer_phone}}</p><p>{{customer_notes}}</p>`,
  en: `<p><strong>{{customer_name}}</strong> · {{customer_email}} · {{customer_phone}}</p><p>{{customer_notes}}</p>`,
  th: `<p><strong>{{customer_name}}</strong> · {{customer_email}} · {{customer_phone}}</p><p>{{customer_notes}}</p>`,
};

const TEMPLATES: Record<EmailLanguage, Record<NotificationEvent, Template>> = {
  de: {
    booking_received: {
      subject: "Ihre Terminanfrage bei {{business_name}}",
      heading: "Danke, {{customer_name}}!",
      intro: "Wir haben Ihre Anfrage erhalten. Sie bekommen eine Bestätigung, sobald wir den Termin geprüft haben.",
    },
    booking_confirmation: {
      subject: "Terminbestätigung: {{service_name}} am {{booking_date}}",
      heading: "Ihr Termin ist bestätigt",
      intro: "Hallo {{customer_name}}, wir freuen uns auf Sie!",
    },
    booking_cancelled: {
      subject: "Ihr Termin am {{booking_date}} wurde storniert",
      heading: "Termin storniert",
      intro: "Hallo {{customer_name}}, der folgende Termin wurde storniert. Neuen Termin buchen: <a href=\"{{rebook_link}}\">{{rebook_link}}</a>",
    },
    booking_reminder: {
      subject: "Erinnerung: morgen um {{booking_time}} Uhr bei {{business_name}}",
      heading: "Bis morgen!",
      intro: "Hallo {{customer_name}}, wir erinnern Sie an Ihren Termin.",
    },
    booking_rescheduled: {
      subject: "Neuer Termin: {{booking_date}}, {{booking_time}} Uhr",
      heading: "Ihr Termin wurde verschoben",
      intro: "Hallo {{customer_name}}, Ihr Termin bei {{business_name}} findet jetzt zu dieser Zeit statt:",
    },
    owner_new_booking: {
      subject: "Neue Buchung: {{service_name}} am {{booking_date}}, {{booking_time}} Uhr",
      heading: "Neue Buchung",
      intro: "Status: {{booking_status}}",
      footer: "<p><a href=\"{{admin_link}}\">Im Zenno-Admin öffnen</a></p>",
    },
    owner_booking_cancelled: {
      subject: "Storniert: {{service_name}} am {{booking_date}}, {{booking_time}} Uhr",
      heading: "Buchung storniert",
      intro: "Dieser Termin ist wieder frei.",
      footer: "<p><a href=\"{{admin_link}}\">Im Zenno-Admin öffnen</a></p>",
    },
  },
  en: {
    booking_received: {
      subject: "Your booking request at {{business_name}}",
      heading: "Thank you, {{customer_name}}!",
      intro: "We received your request. You will get a confirmation as soon as we have checked the appointment.",
    },
    booking_confirmation: {
      subject: "Booking confirmed: {{service_name}} on {{booking_date}}",
      heading: "Your appointment is confirmed",
      intro: "Hi {{customer_name}}, we look forward to seeing you!",
    },
    booking_cancelled: {
      subject: "Your appointment on {{booking_date}} was cancelled",
      heading: "Appointment cancelled",
      intro: "Hi {{customer_name}}, the following appointment was cancelled. Book a new one: <a href=\"{{rebook_link}}\">{{rebook_link}}</a>",
    },
    booking_reminder: {
      subject: "Reminder: tomorrow at {{booking_time}} at {{business_name}}",
      heading: "See you tomorrow!",
      intro: "Hi {{customer_name}}, this is a reminder of your appointment.",
    },
    booking_rescheduled: {
      subject: "New time: {{booking_date}} at {{booking_time}}",
      heading: "Your appointment was moved",
      intro: "Hi {{customer_name}}, your appointment at {{business_name}} is now at this time:",
    },
    owner_new_booking: {
      subject: "New booking: {{service_name}} on {{booking_date}}, {{booking_time}}",
      heading: "New booking",
      intro: "Status: {{booking_status}}",
      footer: "<p><a href=\"{{admin_link}}\">Open in Zenno admin</a></p>",
    },
    owner_booking_cancelled: {
      subject: "Cancelled: {{service_name}} on {{booking_date}}, {{booking_time}}",
      heading: "Booking cancelled",
      intro: "This slot is free again.",
      footer: "<p><a href=\"{{admin_link}}\">Open in Zenno admin</a></p>",
    },
  },
  th: {
    booking_received: {
      subject: "คำขอจองของคุณที่ {{business_name}}",
      heading: "ขอบคุณ {{customer_name}}!",
      intro: "เราได้รับคำขอของคุณแล้ว คุณจะได้รับการยืนยันทันทีที่เราตรวจสอบนัดหมายเรียบร้อย",
    },
    booking_confirmation: {
      subject: "ยืนยันการจอง: {{service_name}} วันที่ {{booking_date}}",
      heading: "นัดหมายของคุณได้รับการยืนยันแล้ว",
      intro: "สวัสดี {{customer_name}} เรายินดีที่จะได้ต้อนรับคุณ!",
    },
    booking_cancelled: {
      subject: "นัดหมายวันที่ {{booking_date}} ของคุณถูกยกเลิกแล้ว",
      heading: "ยกเลิกนัดหมายแล้ว",
      intro: "สวัสดี {{customer_name}} นัดหมายต่อไปนี้ถูกยกเลิกแล้ว จองนัดใหม่: <a href=\"{{rebook_link}}\">{{rebook_link}}</a>",
    },
    booking_reminder: {
      subject: "แจ้งเตือน: พรุ่งนี้เวลา {{booking_time}} น. ที่ {{business_name}}",
      heading: "พบกันพรุ่งนี้!",
      intro: "สวัสดี {{customer_name}} ขอแจ้งเตือนนัดหมายของคุณ",
    },
    booking_rescheduled: {
      subject: "เวลานัดใหม่: {{booking_date}} เวลา {{booking_time}} น.",
      heading: "นัดหมายของคุณถูกเลื่อนแล้ว",
      intro: "สวัสดี {{customer_name}} นัดหมายของคุณที่ {{business_name}} เปลี่ยนเป็นเวลานี้:",
    },
    owner_new_booking: {
      subject: "การจองใหม่: {{service_name}} วันที่ {{booking_date}} เวลา {{booking_time}} น.",
      heading: "การจองใหม่",
      intro: "สถานะ: {{booking_status}}",
      footer: "<p><a href=\"{{admin_link}}\">เปิดในระบบหลังร้าน Zenno</a></p>",
    },
    owner_booking_cancelled: {
      subject: "ยกเลิกแล้ว: {{service_name}} วันที่ {{booking_date}} เวลา {{booking_time}} น.",
      heading: "การจองถูกยกเลิก",
      intro: "ช่วงเวลานี้ว่างอีกครั้งแล้ว",
      footer: "<p><a href=\"{{admin_link}}\">เปิดในระบบหลังร้าน Zenno</a></p>",
    },
  },
};

export function fillTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => variables[key] ?? "");
}

/** Built-in subject + HTML body for an event, already filled in. */
export function renderBuiltIn(
  event: NotificationEvent,
  language: EmailLanguage,
  variables: Record<string, string>,
): { subject: string; html: string } {
  const template = TEMPLATES[language][event];
  const isOwner = OWNER_EVENTS.includes(event);
  const body = [
    `<h2 style="font-weight:600;margin:0 0 8px">${template.heading}</h2>`,
    `<p>${template.intro}</p>`,
    isOwner ? OWNER_DETAILS[language] : "",
    DETAILS[language],
    template.footer ?? (isOwner ? "" : CUSTOMER_FOOTER[language]),
  ].join("\n");
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1917;line-height:1.5;max-width:560px">${body}</div>`;
  return { subject: fillTemplate(template.subject, variables), html: fillTemplate(html, variables) };
}
