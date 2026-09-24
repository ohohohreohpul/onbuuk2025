import { createContext, useContext } from 'react';
import type { HostKind } from './tenantHost';

export interface TenantInfo {
  businessId: string | null;
  businessName: string | null;
  /** The business permalink, which is also its platform subdomain. */
  subdomain: string | null;
  customDomain: string | null;
  planType: 'starter' | 'professional' | 'enterprise';
  hostKind: HostKind;
  isLoading: boolean;
}

export const TenantContext = createContext<TenantInfo>({
  businessId: null,
  businessName: null,
  subdomain: null,
  customDomain: null,
  planType: 'starter',
  hostKind: 'app',
  isLoading: true,
});

export const useTenant = () => useContext(TenantContext);
