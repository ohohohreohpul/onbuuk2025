import { describe, expect, it, vi } from 'vitest';

vi.mock('../functionAuth', () => ({ adminAccessToken: async () => 'token' }));

import {
  parseZernioEvent, signPayload, verifyZernioSignature,
} from '../../../supabase/functions/_shared/social/zernioWebhook';
import {
  AutomationInputError, fromZernioAutomation, readAutomationDraft, toZernioAutomation,
} from '../../../supabase/functions/_shared/social/commentAutomation';
import { parseKeywords } from '../../components/admin/social/socialApi';

const SECRET = 'x'.repeat(40);
const SHOP = '3886dbb5-1138-4ada-8554-e564b749b4c0';

const dm = (overrides: Record<string, unknown> = {}) => ({
  id: 'evt-1',
  event: 'message.received',
  profiles: [{ id: 'p1', externalId: SHOP }],
  account: { id: 'acc-1', accountId: 'acc-1', profileId: 'p1', platform: 'instagram', username: 'sabai.spa' },
  message: {
    id: 'msg-1', conversationId: 'conv-1', platform: 'instagram', direction: 'incoming', text: 'Habt ihr morgen Zeit?',
    sender: { id: 'igsid-9', name: 'Anna', username: 'anna.k' },
  },
  conversation: { id: 'conv-1', participantId: 'igsid-9' },
  ...overrides,
});

describe('verifyZernioSignature', () => {
  it('accepts the HMAC of the raw body, plain or with sha256= prefix', async () => {
    const raw = JSON.stringify(dm());
    const signature = await signPayload(raw, SECRET);
    expect(await verifyZernioSignature(raw, signature, SECRET)).toBe(true);
    expect(await verifyZernioSignature(raw, `sha256=${signature.toUpperCase()}`, SECRET)).toBe(true);
  });

  it('rejects a changed body, a missing header and a short secret', async () => {
    const raw = JSON.stringify(dm());
    const signature = await signPayload(raw, SECRET);
    expect(await verifyZernioSignature(`${raw} `, signature, SECRET)).toBe(false);
    expect(await verifyZernioSignature(raw, null, SECRET)).toBe(false);
    expect(await verifyZernioSignature(raw, await signPayload(raw, 'short'), 'short')).toBe(false);
  });
});

describe('parseZernioEvent', () => {
  it('turns an incoming Instagram DM into a message for the shop', () => {
    expect(parseZernioEvent(dm())).toEqual({
      kind: 'message', businessId: SHOP, accountId: 'acc-1', platform: 'instagram', conversationId: 'conv-1',
      messageId: 'msg-1', text: 'Habt ihr morgen Zeit?', senderId: 'igsid-9', senderName: 'Anna', senderUsername: 'anna.k',
    });
  });

  it('ignores our own outgoing messages, other platforms and empty texts', () => {
    expect(parseZernioEvent(dm({ message: { ...dm().message, direction: 'outgoing' } })).kind).toBe('ignore');
    expect(parseZernioEvent(dm({ account: { ...dm().account, platform: 'whatsapp' }, message: { ...dm().message, platform: 'whatsapp' } })).kind).toBe('ignore');
    expect(parseZernioEvent(dm({ message: { ...dm().message, text: '  ' } })).kind).toBe('ignore');
    expect(parseZernioEvent(null).kind).toBe('ignore');
  });

  it('uses the button text when the customer tapped a quick reply', () => {
    const event = parseZernioEvent(dm({ message: { ...dm().message, text: null }, metadata: { quickReplyPayload: 'BOOK' } }));
    expect(event).toMatchObject({ kind: 'message', text: 'BOOK' });
  });

  it('never trusts an externalId that is not a uuid', () => {
    const event = parseZernioEvent(dm({ profiles: [{ id: 'p1', externalId: "x' OR 1=1" }] }));
    expect(event).toMatchObject({ kind: 'message', businessId: null });
  });

  it('reads account connections', () => {
    const event = parseZernioEvent({
      event: 'account.connected', profiles: [{ externalId: SHOP }],
      account: { accountId: 'acc-2', profileId: 'p1', platform: 'facebook', username: 'Sabai Spa', displayName: 'Sabai Spa' },
    });
    expect(event).toMatchObject({ kind: 'account', connected: true, businessId: SHOP, accountId: 'acc-2', platform: 'facebook' });
  });
});

describe('comment automations', () => {
  const input = {
    name: ' Buchen per Kommentar ', accountId: 'acc-1', keywords: ['Buchen', 'buchen', ' Termin '],
    dmMessage: 'Hier ist der Link:', buttonTitle: 'Jetzt buchen', buttonUrl: 'https://sabai.zennohq.com/', commentReply: '', isActive: true,
  };

  it('cleans the input and builds a whole-word Zernio automation', () => {
    const draft = readAutomationDraft(input);
    expect(draft.keywords).toEqual(['buchen', 'termin']);
    expect(toZernioAutomation(draft, 'profile-1')).toEqual({
      profileId: 'profile-1', accountId: 'acc-1', name: 'Buchen per Kommentar', trigger: 'comment', keywords: ['buchen', 'termin'],
      matchMode: 'word', typoTolerance: true, dmMessage: 'Hier ist der Link:',
      buttons: [{ type: 'url', title: 'Jetzt buchen', url: 'https://sabai.zennohq.com/' }], isActive: true,
    });
  });

  it('leaves profile and account out of an update', () => {
    const body = toZernioAutomation(readAutomationDraft(input), null);
    expect(body).not.toHaveProperty('profileId');
    expect(body).not.toHaveProperty('accountId');
  });

  it('refuses missing keywords, half a button and non-https links', () => {
    expect(() => readAutomationDraft({ ...input, keywords: [] })).toThrow(AutomationInputError);
    expect(() => readAutomationDraft({ ...input, buttonUrl: '' })).toThrow(/both a label and a link/);
    expect(() => readAutomationDraft({ ...input, buttonUrl: 'http://x.de' })).toThrow(/https/);
    expect(() => readAutomationDraft({ ...input, dmMessage: ' ' })).toThrow(AutomationInputError);
  });

  it('reads Zernio automations back for the admin list', () => {
    expect(fromZernioAutomation({
      id: 'a1', name: 'Buchen', accountId: 'acc-1', platform: 'instagram', keywords: ['buchen'], dmMessage: 'Hi',
      buttons: [{ type: 'url', title: 'Buchen', url: 'https://x.de' }], isActive: false, stats: { dmsSent: 12 },
    })).toMatchObject({ id: 'a1', buttonTitle: 'Buchen', buttonUrl: 'https://x.de', isActive: false, sent: 12, commentReply: '' });
  });

  it('splits typed keywords on commas and lines', () => {
    expect(parseKeywords('Buchen, termin\nBUCHEN,, ')).toEqual(['buchen', 'termin']);
  });
});
