import { describe, expect, it } from 'vitest';
import {
  firstNameOf, personalize, renderMarketingEmail, textToHtml, type MarketingBlock, type MarketingShop,
} from '../../../supabase/functions/_shared/marketingEmail';
import { campaignToContent } from '../../../supabase/functions/_shared/marketingData';

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
  const blocks: MarketingBlock[] = [
    { type: 'hero', logoUrl: 'https://cdn.example.de/logo.png', imageUrl: 'https://cdn.example.de/photo.jpg', headline: 'Zeit für Sie.\nDer Alltag kann warten.', buttonText: 'Jetzt buchen', buttonUrl: 'https://shop.example.de', caption: 'Online kaufen' },
    { type: 'text', text: 'Hallo {vorname}' },
    { type: 'image', url: 'https://cdn.example.de/card.png', size: 'small' },
    { type: 'vouchers', title: null, showImages: false },
  ];
  const content = { subject: 'Angebot für {vorname}', blocks };
  const vouchers = [{ name: '5er-Karte', detail: '5 × 60 Min', priceCents: 29000, compareCents: 31000, url: 'https://shop.example.de/?gutschein=1&karte=1', imageUrl: 'https://cdn.example.de/v.jpg' }];

  it('renders blocks in order with logo, photo, text, image, cards and the unsubscribe link', () => {
    const { subject, html } = renderMarketingEmail(shop, content, 'Anna', 'https://x.test/u?t=abc', vouchers);
    expect(subject).toBe('Angebot für Anna');
    const order = ['logo.png', 'photo.jpg', 'Zeit für Sie.<br><span', 'Hallo Anna', 'card.png', '5er-Karte', 'href="https://x.test/u?t=abc"'];
    const positions = order.map((part) => html.indexOf(part));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html).toMatch(/290\s?€/);
    expect(html).not.toMatch(/zenno/i);
  });

  it('never puts text over the photo (unreadable in phone dark mode)', () => {
    const { html } = renderMarketingEmail(shop, content, 'Anna', 'https://x.test/u');
    expect(html).not.toContain('background-image');
  });

  it('hides voucher photos unless the block asks for them', () => {
    expect(renderMarketingEmail(shop, content, '', 'https://x.test/u', vouchers).html).not.toContain('v.jpg');
    const withPhotos = { ...content, blocks: [{ type: 'vouchers', showImages: true } as MarketingBlock] };
    expect(renderMarketingEmail(shop, withPhotos, '', 'https://x.test/u', vouchers).html).toContain('v.jpg');
  });

  it('shows "Gesendet mit Zenno" only when the shop shows the Zenno badge', () => {
    expect(renderMarketingEmail({ ...shop, showZennoBadge: true }, content, '', 'https://x.test/u').html).toContain('Gesendet mit Zenno');
  });

  it('drops buttons and images whose link is not https', () => {
    const unsafe = { subject: 'x', blocks: [
      { type: 'button', text: 'Klick', url: 'javascript:alert(1)' },
      { type: 'image', url: 'http://insecure.example/a.png' },
    ] as MarketingBlock[] };
    const { html } = renderMarketingEmail(shop, unsafe, '', 'https://x.test/u');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('insecure.example');
  });
});

describe('campaignToContent', () => {
  it('converts a campaign from before the block editor', () => {
    const { blocks } = campaignToContent({
      subject: 's', body: 'Hallo', button_text: 'Los', button_url: 'https://a.de', headline: 'Titel', logo_url: 'https://a.de/l.png',
      vouchers_enabled: true, closing: 'Tschüss', blocks: [],
    });
    expect(blocks.map((block) => block.type)).toEqual(['hero', 'text', 'vouchers', 'text']);
  });

  it('keeps stored blocks and drops unknown block types', () => {
    const { blocks } = campaignToContent({
      subject: 's', body: '', button_text: null, button_url: null,
      blocks: [{ type: 'text', text: 'a' }, { type: 'evil' } as unknown as MarketingBlock],
    });
    expect(blocks).toEqual([{ type: 'text', text: 'a' }]);
  });
});
