/**
 * Turns the email settings form into the row to save. Secrets are write-only:
 * an empty password / API key field keeps the stored one (the browser can't
 * read it back), and switching provider clears the other provider's secrets.
 */

export const SMTP_PORT = 465;
const BLOCKED_SMTP_PORTS = [25, 587];

export interface EmailSettingsForm {
  provider: string;
  fromEmail: string;
  fromName: string;
  apiKey: string;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  hasApiKey: boolean;
  hasSmtpPassword: boolean;
}

export interface EmailSettingsPayload {
  provider: string;
  from_email: string;
  from_name: string;
  api_key?: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password?: string | null;
}

export type EmailSettingsResult =
  | { ok: true; payload: EmailSettingsPayload }
  | { ok: false; error: string };

export function buildEmailSettingsPayload(form: EmailSettingsForm): EmailSettingsResult {
  const fromEmail = form.fromEmail.trim();
  const fromName = form.fromName.trim();
  if (!fromEmail || !fromName) {
    return { ok: false, error: 'From Email and From Name are required.' };
  }
  const base = { provider: form.provider, from_email: fromEmail, from_name: fromName };

  if (form.provider !== 'smtp') {
    const apiKey = form.apiKey.trim();
    if (!apiKey && !form.hasApiKey) {
      return { ok: false, error: 'API Key is required for this provider.' };
    }
    return {
      ok: true,
      payload: {
        ...base,
        ...(apiKey ? { api_key: apiKey } : {}),
        smtp_host: null,
        smtp_port: null,
        smtp_username: null,
        smtp_password: null,
      },
    };
  }

  const smtpHost = form.smtpHost.trim();
  const smtpUsername = form.smtpUsername.trim();
  if (!smtpHost || !smtpUsername) {
    return { ok: false, error: 'SMTP server and user name are required.' };
  }
  if (BLOCKED_SMTP_PORTS.includes(form.smtpPort)) {
    return { ok: false, error: `Use port ${SMTP_PORT} (SSL). Ports 25 and 587 are blocked on our servers.` };
  }
  if (!form.smtpPassword && !form.hasSmtpPassword) {
    return { ok: false, error: 'Enter the mailbox password.' };
  }
  return {
    ok: true,
    payload: {
      ...base,
      api_key: null,
      smtp_host: smtpHost,
      smtp_port: form.smtpPort || SMTP_PORT,
      smtp_username: smtpUsername,
      ...(form.smtpPassword ? { smtp_password: form.smtpPassword } : {}),
    },
  };
}
