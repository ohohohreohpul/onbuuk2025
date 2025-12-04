import { createContext, useContext } from 'react';

export interface TenantInfo {
  businessId: string | null;
  businessName: string | null;
  subdomain: string | null;
  customDomain: string | null;
  planType: 'starter' | 'professional' | 'enterprise';
  isLoading: boolean;
}

export const TenantContext = createContext<TenantInfo>({
  businessId: null,
  businessName: null,
  subdomain: null,
  customDomain: null,
  planType: 'starter',
  isLoading: true,
});

export const useTenant = () => useContext(TenantContext);

export function extractSubdomain(hostname: string): string | null {
  if (hostname === 'localhost' || hostname.startsWith('192.168.') || hostname.startsWith('127.0.0.1')) {
    return 'demo';
  }

  if (hostname.includes('stackblitz') || hostname.includes('webcontainer') || hostname.includes('csb.app') || hostname.includes('githubpreview') || hostname.includes('.local')) {
    return 'demo';
  }

  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0];
  }

  return 'demo';
}

export function extractCustomDomain(hostname: string): string | null {
  if (hostname === 'localhost' || hostname.startsWith('192.168.') || hostname.startsWith('127.0.0.1')) {
    return null;
  }

  const parts = hostname.split('.');
  if (parts.length === 2) {
    return hostname;
  }

  return null;
}
