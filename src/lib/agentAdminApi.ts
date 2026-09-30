import { supabase } from './supabase';

// Client helper for the merchant "AI Agents" dashboard.
// All calls go through the agent-admin edge function (service role), so the
// agent_api_keys / agent_bookings / agent_events tables stay default-deny.

export interface AgentSettings {
  agent_enabled: boolean;
  agent_consent_policy: 'auto' | 'manual';
  agent_lead_time_minutes: number;
  agent_slot_hold_seconds: number;
  vertical: string | null;
  city: string | null;
  address_line: string | null;
  agent_description: string | null;
}

export interface AgentKeyRow {
  id: string;
  key_prefix: string;
  label: string | null;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface AgentBookingRow {
  id: string;
  booking_id: string;
  agent_name: string | null;
  confidence: number | null;
  source: string | null;
  created_at: string;
  bookings: {
    status: string;
    booking_date: string;
    start_time: string;
    customer_name: string;
  } | null;
}

export interface AgentEventRow {
  id: string;
  action: string;
  result: string | null;
  confidence: number | null;
  created_at: string;
  payload: unknown;
}

async function call<T>(action: string, payload?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke('agent-admin', {
    body: { action, payload },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export async function getAgentSettings(): Promise<{ settings: AgentSettings }> {
  return call<{ settings: AgentSettings }>('get_settings');
}

export async function updateAgentSettings(
  patch: Partial<AgentSettings>,
): Promise<{ settings: AgentSettings }> {
  return call<{ settings: AgentSettings }>('update_settings', patch);
}

export async function listAgentKeys(): Promise<{ keys: AgentKeyRow[] }> {
  return call<{ keys: AgentKeyRow[] }>('list_keys');
}

export async function createAgentKey(
  label: string,
): Promise<{ key: string; record: AgentKeyRow }> {
  return call<{ key: string; record: AgentKeyRow }>('create_key', { label });
}

export async function revokeAgentKey(keyId: string): Promise<{ ok: boolean }> {
  return call<{ ok: boolean }>('revoke_key', { keyId });
}

export async function listAgentBookings(): Promise<{ bookings: AgentBookingRow[] }> {
  return call<{ bookings: AgentBookingRow[] }>('list_agent_bookings');
}

export async function listAgentEvents(): Promise<{ events: AgentEventRow[] }> {
  return call<{ events: AgentEventRow[] }>('list_events');
}