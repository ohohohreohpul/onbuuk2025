import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: {} }));
import { EMPTY_CUSTOMER_DETAILS, isValidBirthday, marketingBookingFields } from '../customerDetails';
import { renderNewsletterConfirmEmail } from '../../../supabase/functions/_shared/newsletterConfirmEmail';
import { EMPTY_DRAFT, campaignToDraft, isAutomation, starterDraft, type Campaign } from '../../components/admin/marketing/marketingApi';
import { AUTOMATION_STARTERS } from '../../components/admin/marketing/automationText';

const TODAY = new Date('2026-10-31T10:00:00Z');

describe('isValidBirthday', () => {
  it('accepts a real past date', () => {
    expect(isValidBirthday('1990-02-28', TODAY)).toBe(true);
    expect(isValidBirthday('2000-02-29', TODAY)).toBe(true);
  });

  it('rejects impossible, future and too-old dates', () => {
    expect(isValidBirthday('1990-02-30', TODAY)).toBe(false);
    expect(isValidBirthday('2027-01-01', TODAY)).toBe(false);
    expect(isValidBirthday('1899-12-31', TODAY)).toBe(false);
    expect(isValidBirthday('', TODAY)).toBe(false);
    expect(isValidBirthday('31.12.1990', TODAY)).toBe(false);
  });
});

describe('marketingBookingFields', () => {
  it('sends nothing extra when the customer left both fields empty', () => {
    expect(marketingBookingFields(EMPTY_CUSTOMER_DETAILS)).toEqual({ customer_birthday: null, newsletter_opt_in: false });
  });

  it('passes a valid birthday and the opt-in', () => {
    const details = { ...EMPTY_CUSTOMER_DETAILS, birthday: '1985-06-15', newsletterOptIn: true };
    expect(marketingBookingFields(details)).toEqual({ customer_birthday: '1985-06-15', newsletter_opt_in: true });
  });

  it('drops an invalid birthday instead of failing the booking', () => {
    const details = { ...EMPTY_CUSTOMER_DETAILS, birthday: '1985-13-40' };
    expect(marketingBookingFields(details).customer_birthday).toBeNull();
  });
});

describe('renderNewsletterConfirmEmail', () => {
  it('names the shop and links the confirm page', () => {
    const { subject, html } = renderNewsletterConfirmEmail('de', 'Sabai Massage', 'Anna Schmidt', 'https://book.zennohq.com/api/n?a=confirm&t=abc');
    expect(subject).toBe('Bitte bestätigen Sie Ihre Anmeldung bei Sabai Massage');
    expect(html).toContain('Hallo Anna,');
    expect(html).toContain('href="https://book.zennohq.com/api/n?a=confirm&amp;t=abc"');
    expect(html.replace(/href="[^"]*"/g, '')).not.toMatch(/zenno/i);
  });

  it('escapes the shop name', () => {
    const { html } = renderNewsletterConfirmEmail('en', '<b>Spa</b>', '', 'https://x.test');
    expect(html).toContain('&lt;b&gt;Spa&lt;/b&gt;');
    expect(html).not.toContain('Hello ,');
  });
});

describe('starterDraft', () => {
  it('makes birthday and win-back automations for all non-unsubscribed customers', () => {
    const draft = starterDraft('birthday', AUTOMATION_STARTERS.de.birthday, 'https://sabai.zennohq.com/');
    expect(draft.kind).toBe('birthday');
    expect(draft.audience).toBe('all');
    expect(draft.is_active).toBe(false);
    expect(draft.subject).toContain('{vorname}');
    expect(draft.blocks[0]).toMatchObject({ type: 'hero', buttonUrl: 'https://sabai.zennohq.com/' });
  });

  it('keeps special days to newsletter subscribers and stores the date', () => {
    const draft = starterDraft('special_day', AUTOMATION_STARTERS.en.special_day, '', '2027-02-14');
    expect(draft.audience).toBe('subscribers');
    expect(draft.send_on).toBe('2027-02-14');
  });

  it('only birthday and win-back are automations', () => {
    expect(isAutomation('birthday')).toBe(true);
    expect(isAutomation('winback')).toBe(true);
    expect(isAutomation('monthly')).toBe(false);
    expect(isAutomation('special_day')).toBe(false);
  });
});

describe('campaignToDraft', () => {
  it('treats campaigns saved before automations existed as monthly', () => {
    const legacy = { ...EMPTY_DRAFT, id: 'c1', business_id: 'b1', body: '', button_text: null, button_url: null, next_send_at: null, last_queued_at: null } as unknown as Campaign;
    delete (legacy as Partial<Campaign>).kind;
    expect(campaignToDraft(legacy).kind).toBe('monthly');
  });
});
