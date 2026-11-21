import { adminAccessToken } from '../../../lib/functionAuth';

export type SocialPlatform = 'instagram' | 'facebook';
/** Accounts a shop can connect: Instagram/Facebook (DMs, comments) and Google Business Profile (local SEO). */
export type ConnectPlatform = SocialPlatform | 'googlebusiness';

export interface SocialAccount {
  id: string;
  platform: ConnectPlatform;
  username: string | null;
  displayName: string | null;
  pictureUrl: string | null;
  isActive: boolean;
}

export interface Automation {
  id: string;
  name: string;
  accountId: string;
  platform: string;
  keywords: string[];
  dmMessage: string;
  buttonTitle: string;
  buttonUrl: string;
  commentReply: string;
  isActive: boolean;
  sent: number | null;
}

export type AutomationDraft = Omit<Automation, 'id' | 'platform' | 'sent'>;

/** The Social plan is missing (HTTP 402 from social-admin). */
export class PlanRequiredError extends Error {}

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await adminAccessToken()}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 402) throw new PlanRequiredError(data.error ?? 'plan required');
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data as T;
}

export const loadStatus = () => call<{ hasSocial: boolean; hasLocalSeo: boolean; ownZernio: boolean; accounts: SocialAccount[] }>('status');
/** Owner only: use the shop's own Zernio account (its own bill) instead of Zenno's. */
export const connectOwnZernio = (apiKey: string) => call<{ ownZernio: boolean; accounts: SocialAccount[] }>('connect_zernio', { apiKey });
export const disconnectOwnZernio = () => call<{ ownZernio: boolean; accounts: SocialAccount[] }>('disconnect_zernio');
export const syncAccounts = () => call<{ accounts: SocialAccount[] }>('sync');
export const disconnectAccount = (accountId: string) => call<{ accounts: SocialAccount[] }>('disconnect', { accountId });
export const loadAutomations = () => call<{ automations: Automation[] }>('automations');
export const saveAutomation = (id: string | null, draft: AutomationDraft) =>
  call<{ automation: Automation }>('save_automation', { ...(id ? { id } : {}), ...draft });
export const deleteAutomation = (id: string) => call<{ deleted: boolean }>('delete_automation', { id });

/** Opens Instagram's, Facebook's or Google's own consent page; it returns to ?view=social&connected=… */
export async function startConnect(platform: ConnectPlatform): Promise<void> {
  const { url } = await call<{ url: string }>('connect', { platform });
  window.location.href = url;
}

/** Comma- or line-separated keywords as typed by the owner. */
export const parseKeywords = (value: string): string[] =>
  [...new Set(value.split(/[,\n]/).map((k) => k.trim().toLowerCase()).filter(Boolean))].slice(0, 10);
