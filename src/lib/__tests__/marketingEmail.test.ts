import { describe, expect, it } from 'vitest';
import {
  firstNameOf, personalize, renderMarketingEmail, textToHtml, type MarketingShop,
} from '../../../supabase/functions/_shared/marketingEmail';

const shop: MarketingShop = {
  name: 'Prakun Thai Massage',
  address: 'Winterhuder Weg 24 22085 Hamburg',
  phone: '040 1234',
  logoUrl: '/defbuuklogo.png',
  primaryColor: '#5A1F4A',
  accentColor: '#D2A647',
  language: 'de',
  shopUrl: 'https://shop.example.de',
  showZennoBadge: false,
};

describe('personalize', () => {
  it('fills the first name', () => {
    expect(personalize('Hallo {vorname},', 'Anna')).toBe('Hallo Anna,');
  });

  it('tidies the greeting when the name is unknown', () => {
    expect(personalize('Hallo {vorname},', '')).toBe('Hallo,');
  });
});

describe('firstNameOf', () => {
  it('takes the first word of the stored name', () => {
    expect(firstNameOf('  Anna Maria Schmidt ')).toBe('Anna');
    expect(firstNameOf(null)).toBe('');
  });
});

describe('textToHtml', () => {
  it('escapes HTML and keeps paragraphs and line breaks', () => {
    const html = textToHtml('<b>Hi</b>\nline two\n\nSecond paragraph');
    expect(html).toContain('&lt;b&gt;Hi&lt;/b&gt;<br>line two');
    expect(html.match(/<p /g)).toHaveLength(2);
  });
});

describe('renderMarketingEmail', () => {
  const content = { subject: 'Angebot für {vorname}', body: 'Hallo {vorname}', buttonText: 'Jetzt buchen', buttonUrl: 'https://shop.example.de' };

  it('shows shop branding, the button and the unsubscribe link', () => {
    const { subject, html } = renderMarketingEmail(shop, content, 'Anna', 'https://x.test/u?t=abc');
    expect(subject).toBe('Angebot für Anna');
    expect(html).toContain('Prakun Thai Massage');
    expect(html).toContain('href="https://shop.example.de"');
    expect(html).toContain('href="https://x.test/u?t=abc"');
    expect(html).toContain('Abmelden');
    expect(html).not.toMatch(/zenno/i);
  });

  it('shows "Gesendet mit Zenno" only when the shop shows the Zenno badge', () => {
    const { html } = renderMarketingEmail({ ...shop, showZennoBadge: true }, content, '', 'https://x.test/u');
    expect(html).toContain('Gesendet mit Zenno');
  });

  it('renders a two-tone headline and voucher cards with prices', () => {
    const { html } = renderMarketingEmail(shop, { ...content, headline: 'Zeit für Sie.\nDer Alltag kann warten.' }, 'Anna', 'https://x.test/u', [
      { name: '5er-Karte', detail: '5 × 60 Min', priceCents: 29000, compareCents: 31000, url: 'https://shop.example.de/?gutschein=1&karte=1' },
    ]);
    expect(html).toContain('Zeit für Sie.<br><span');
    expect(html).toContain('5er-Karte');
    expect(html).toMatch(/290\s?€/);
    expect(html).toContain('href="https://shop.example.de/?gutschein=1&amp;karte=1"');
  });

  it('drops a button whose link is not https', () => {
    const { html } = renderMarketingEmail(shop, { ...content, buttonUrl: 'javascript:alert(1)' }, '', 'https://x.test/u');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('Jetzt buchen');
  });
});
