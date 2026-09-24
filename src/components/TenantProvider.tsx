import { useEffect, useState } from 'react';
import { TenantContext, TenantInfo } from '../lib/tenantContext';
import { supabase } from '../lib/supabase';
import {
  ARE_SHOP_SUBDOMAINS_LIVE,
  classifyHost,
  hostUrl,
  isAppOnlyPath,
  isDevHost,
  shopUrl,
  type HostKind,
} from '../lib/tenantHost';

/**
 * Resolves the current business from the hostname only.
 *
 * - Shop hosts (salon-a.zennohq.studio, salon-a.de) ask the server via
 *   resolve_tenant(host). Nothing else can select a business on a shop host:
 *   no path segment, no localStorage.
 * - The app host serves admin/login/sign-up. Admin screens get their business
 *   from the signed-in account (get_admin_business_id), never from the URL.
 * - Old links on the app host (/salon-a/...) redirect to the shop's own host.
 */

/** Paths on the app host that are platform pages, not old shop links. */
const APP_HOST_SYSTEM_PATHS = new Set([
  'admin', 'staff', 'superadmin', 'login', 'register', 'signup', 'signup-success',
  'forgot-password', 'reset-password', 'cancel', 'account', 'accept-invite',
  'booking-success', 'gift-card-success', 'payment-cancelled',
]);

const ADMIN_PATH = /(^|\/)(admin|staff|superadmin)(\/|$)/;

interface BusinessRow {
  id: string;
  name: string;
  permalink: string;
  plan_type: TenantInfo['planType'];
}

interface ResolvedTenantRow {
  business_id: string;
  business_name: string;
  permalink: string;
  plan_type: TenantInfo['planType'];
  match_type: 'custom_domain' | 'platform_subdomain';
  primary_host: string;
  is_primary_host: boolean;
}

type Resolution =
  | { kind: 'tenant'; business: BusinessRow; customDomain: string | null }
  | { kind: 'none' }
  | { kind: 'redirecting' };

const EMPTY_TENANT = {
  businessId: null,
  businessName: null,
  subdomain: null,
  customDomain: null,
  planType: 'starter' as const,
};

const currentPathWithQuery = () =>
  `${window.location.pathname}${window.location.search}${window.location.hash}`;

async function resolveShopHost(): Promise<Resolution> {
  const { data, error } = await supabase.rpc('resolve_tenant', { p_host: window.location.host });
  if (error) {
    console.error('Could not resolve shop for this address:', error);
    throw new Error('We could not load this shop right now.');
  }

  const row = (data as ResolvedTenantRow[] | null)?.[0];
  if (!row) return { kind: 'none' };

  // One canonical address per shop (e.g. its custom domain). Skipped locally.
  if (!row.is_primary_host && !isDevHost(window.location.hostname)) {
    window.location.replace(hostUrl(row.primary_host, currentPathWithQuery()));
    return { kind: 'redirecting' };
  }

  return {
    kind: 'tenant',
    business: { id: row.business_id, name: row.business_name, permalink: row.permalink, plan_type: row.plan_type },
    customDomain: row.match_type === 'custom_domain' ? window.location.hostname : null,
  };
}

async function fetchBusiness(column: 'id' | 'permalink', value: string): Promise<BusinessRow | null> {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, permalink, plan_type')
    .eq(column, value)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Could not load business:', error);
    throw new Error('We could not load this business right now.');
  }
  return data as BusinessRow | null;
}

async function resolveAdminBusiness(): Promise<Resolution> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return { kind: 'none' };

  const { data: businessId, error } = await supabase.rpc('get_admin_business_id');
  if (error) {
    console.error('Could not determine your business:', error);
    throw new Error('We could not determine your business.');
  }
  if (!businessId) return { kind: 'none' };

  const business = await fetchBusiness('id', businessId as string);
  return business ? { kind: 'tenant', business, customDomain: null } : { kind: 'none' };
}

async function resolveAppHost(): Promise<Resolution> {
  const { pathname, search, hash } = window.location;

  if (ADMIN_PATH.test(pathname)) return resolveAdminBusiness();

  const [firstSegment, ...rest] = pathname.split('/').filter(Boolean);
  if (!firstSegment || APP_HOST_SYSTEM_PATHS.has(firstSegment) || isAppOnlyPath(pathname)) {
    return { kind: 'none' };
  }

  // An old shop link: /salon-a/... on the app host.
  const business = await fetchBusiness('permalink', firstSegment.toLowerCase());
  if (!business) return { kind: 'none' };

  if (ARE_SHOP_SUBDOMAINS_LIVE || isDevHost(window.location.hostname)) {
    window.location.replace(shopUrl(business.permalink, `/${rest.join('/')}${search}${hash}`));
    return { kind: 'redirecting' };
  }

  // Transitional: serve the old link in place until shop subdomains are live.
  return { kind: 'tenant', business, customDomain: null };
}

async function resolve(hostKind: HostKind): Promise<Resolution> {
  return hostKind === 'shop' ? resolveShopHost() : resolveAppHost();
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [hostKind] = useState<HostKind>(() => classifyHost(window.location.hostname));
  const [tenantInfo, setTenantInfo] = useState<TenantInfo>({ ...EMPTY_TENANT, hostKind, isLoading: true });

  useEffect(() => {
    let isCancelled = false;

    resolve(hostKind)
      .then((result) => {
        if (isCancelled || result.kind === 'redirecting') return;
        if (result.kind === 'none') {
          setTenantInfo({ ...EMPTY_TENANT, hostKind, isLoading: false });
          return;
        }
        setTenantInfo({
          businessId: result.business.id,
          businessName: result.business.name,
          subdomain: result.business.permalink,
          customDomain: result.customDomain,
          planType: result.business.plan_type,
          hostKind,
          isLoading: false,
        });
      })
      .catch((error) => {
        console.error('Tenant resolution failed:', error);
        if (!isCancelled) setTenantInfo({ ...EMPTY_TENANT, hostKind, isLoading: false });
      });

    return () => {
      isCancelled = true;
    };
  }, [hostKind]);

  return <TenantContext.Provider value={tenantInfo}>{children}</TenantContext.Provider>;
}
