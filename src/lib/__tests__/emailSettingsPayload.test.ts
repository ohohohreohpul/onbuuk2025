import { describe, expect, it } from 'vitest';
import { buildEmailSettingsPayload, type EmailSettingsForm } from '../emailSettingsPayload';

const STRATO: EmailSettingsForm = {
  provider: 'smtp',
  fromEmail: 'info@satuuu99.de',
  fromName: 'SATUUU99',
  apiKey: '',
  smtpHost: ' smtp.strato.de ',
  smtpPort: 465,
  smtpUsername: 'info@satuuu99.de',
  smtpPassword: 'mailbox-password',
  hasApiKey: false,
  hasSmtpPassword: false,
};

describe('buildEmailSettingsPayload', () => {
  it('saves a complete Strato SMTP setup and clears any old API key', () => {
    const result = buildEmailSettingsPayload(STRATO);

    expect(result).toEqual({
      ok: true,
      payload: {
        provider: 'smtp',
        from_email: 'info@satuuu99.de',
        from_name: 'SATUUU99',
        api_key: null,
        smtp_host: 'smtp.strato.de',
        smtp_port: 465,
        smtp_username: 'info@satuuu99.de',
        smtp_password: 'mailbox-password',
      },
    });
  });

  it('keeps the stored password when the field is left empty', () => {
    const result = buildEmailSettingsPayload({ ...STRATO, smtpPassword: '', hasSmtpPassword: true });

    expect(result.ok).toBe(true);
    expect(result.ok && 'smtp_password' in result.payload).toBe(false);
  });

  it('asks for a password when none is stored yet', () => {
    expect(buildEmailSettingsPayload({ ...STRATO, smtpPassword: '' })).toEqual({
      ok: false,
      error: 'Enter the mailbox password.',
    });
  });

  it('rejects ports our servers cannot use', () => {
    const result = buildEmailSettingsPayload({ ...STRATO, smtpPort: 587 });

    expect(result).toEqual({ ok: false, error: 'Use port 465 (SSL). Ports 25 and 587 are blocked on our servers.' });
  });

  it('saves an API provider and clears the SMTP fields', () => {
    const result = buildEmailSettingsPayload({ ...STRATO, provider: 'resend', apiKey: 're_123' });

    expect(result).toEqual({
      ok: true,
      payload: {
        provider: 'resend',
        from_email: 'info@satuuu99.de',
        from_name: 'SATUUU99',
        api_key: 're_123',
        smtp_host: null,
        smtp_port: null,
        smtp_username: null,
        smtp_password: null,
      },
    });
  });

  it('keeps a stored API key when the field is left empty', () => {
    const result = buildEmailSettingsPayload({ ...STRATO, provider: 'resend', apiKey: '', hasApiKey: true });

    expect(result.ok && 'api_key' in result.payload).toBe(false);
  });

  it('requires sender address and name', () => {
    expect(buildEmailSettingsPayload({ ...STRATO, fromName: ' ' })).toEqual({
      ok: false,
      error: 'From Email and From Name are required.',
    });
  });
});
