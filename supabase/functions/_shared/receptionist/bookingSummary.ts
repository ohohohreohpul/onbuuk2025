// A booking may only be made after the customer saw what it is and what it costs:
// the assistant's last message before the customer's reply must name the time and
// the price. Deterministic backstop for the model and the Jev agreement check.

const TURN = /^(Customer|Assistant): /;

interface Turn { who: "Customer" | "Assistant"; text: string }

function turnsOf(transcript: string): Turn[] {
  const turns: Turn[] = [];
  for (const line of transcript.split("\n")) {
    const match = TURN.exec(line);
    if (match) turns.push({ who: match[1] as Turn["who"], text: line.slice(match[0].length) });
    else if (turns.length) turns[turns.length - 1].text += `\n${line}`;
  }
  return turns;
}

/** "16:00" is written as 16:00, 16.00 or 16 Uhr; "16:30" as 16:30 or 16.30. */
function mentionsTime(text: string, time: string): boolean {
  const [hours, minutes] = time.split(":");
  const hour = String(Number(hours));
  const exact = new RegExp(`\\b0?${hour}[:.]${minutes}\\b`);
  const fullHour = minutes === "00" ? new RegExp(`\\b0?${hour}\\s?(Uhr|h)\\b`, "i") : null;
  return exact.test(text) || (fullHour?.test(text) ?? false);
}

/** 7000 cents is written as 70 €, 70,00 €, 70 Euro, € 70 or 70 EUR. */
function mentionsPrice(text: string, priceCents: number): boolean {
  const euros = Math.floor(priceCents / 100);
  const cents = String(priceCents % 100).padStart(2, "0");
  const amount = cents === "00" ? `${euros}(?:[.,]00|,-)?` : `${euros}[.,]${cents}`;
  return new RegExp(`(\\b${amount}\\s?(€|EUR\\b|Euro\\b))|(€\\s?${amount}\\b)`, "i").test(text);
}

/** True when the assistant's message right before the customer's latest reply showed time and price. */
export function summaryWasShown(transcript: string, time: string, priceCents: number): boolean {
  const turns = turnsOf(transcript);
  let i = turns.length - 1;
  if (i < 0 || turns[i].who !== "Customer") return false;
  while (i >= 0 && turns[i].who === "Customer") i--;
  if (i < 0) return false;
  const summary = turns[i].text;
  return mentionsTime(summary, time) && mentionsPrice(summary, priceCents);
}
