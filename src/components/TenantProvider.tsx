import { useState, useEffect, useRef } from 'react';
import { TenantContext, TenantInfo, extractSubdomain, extractCustomDomain } from '../lib/tenantContext';
import { supabase } from '../lib/supabase';
import { executeWithTimeout } from '../lib/queryUtils';

const RESERVED_ROUTES = [
  'admin',
  'staff',
  'superadmin',
  'login',
  'register',
  'signup',
  'signup-success',
  'forgot-password',
  'reset-password',
  'cancel',
  'account',
  'accept-invite',
];

const TENANT_FETCH_TIMEOUT = 8000;
const MAX_RETRIES = 2;

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenantInfo, setTenantInfo] = useState<TenantInfo>({
    businessId: null,
    businessName: null,
    subdomain: null,
    customDomain: null,
    planType: 'starter',
    isLoading: true,
  });

  const mountedRef = useRef(true);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    async function fetchTenantInfo() {
      const abortController = new AbortController();

      fetchTimeoutRef.current = setTimeout(() => {
        abortController.abort();
        if (mountedRef.current) {
          console.error('Tenant fetch timeout - loading without business context');
          setTenantInfo({
            businessId: null,
            businessName: null,
            subdomain: null,
            customDomain: null,
            planType: 'starter',
            isLoading: false,
          });
        }
      }, TENANT_FETCH_TIMEOUT);

      try {
        let business = null;
        const currentPath = window.location.pathname;
        const hostname = window.location.hostname;
        const isAdminRoute = currentPath === '/admin' || currentPath.includes('/admin');

        if (!isAdminRoute) {
          const customDomainResult = await executeWithTimeout(
            supabase
              .from('custom_domains')
              .select('business_id, businesses(*)')
              .eq('domain', hostname)
              .eq('status', 'verified')
              .eq('dns_configured', true)
              .maybeSingle(),
            { timeout: 3000, retries: 1 }
          );

          if (customDomainResult.data?.businesses) {
            business = customDomainResult.data.businesses;
          }
        }

        if (!business && isAdminRoute) {
          try {
            const { data: { user } } = await Promise.race([
              supabase.auth.getUser(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Auth timeout')), 3000)
              )
            ]);

            if (user) {
              const adminUserResult = await executeWithTimeout(
                supabase
                  .from('admin_users')
                  .select('business_id')
                  .eq('email', user.email)
                  .eq('is_active', true)
                  .maybeSingle(),
                { timeout: 3000, retries: 1 }
              );

              if (adminUserResult.data?.business_id) {
                const businessResult = await executeWithTimeout(
                  supabase
                    .from('businesses')
                    .select('*')
                    .eq('id', adminUserResult.data.business_id)
                    .eq('is_active', true)
                    .maybeSingle(),
                  { timeout: 3000, retries: 1 }
                );

                business = businessResult.data;
              }
            }
          } catch (authError) {
            console.warn('Auth check failed in TenantProvider:', authError);
          }

          if (!business) {
            const storedBusinessId = localStorage.getItem('current_business_id');
            if (storedBusinessId) {
              const businessResult = await executeWithTimeout(
                supabase
                  .from('businesses')
                  .select('*')
                  .eq('id', storedBusinessId)
                  .eq('is_active', true)
                  .maybeSingle(),
                { timeout: 3000, retries: 1 }
              );

              business = businessResult.data;
            }
          }
        } else if (!business) {
          const pathParts = currentPath.split('/').filter(p => p);
          const firstSegment = pathParts[0];

          const isReservedRoute = firstSegment && RESERVED_ROUTES.includes(firstSegment);
          const permalinkFromUrl = firstSegment && !isReservedRoute ? firstSegment : null;

          if (permalinkFromUrl) {
            const businessResult = await executeWithTimeout(
              supabase
                .from('businesses')
                .select('*')
                .eq('permalink', permalinkFromUrl)
                .eq('is_active', true)
                .maybeSingle(),
              { timeout: 3000, retries: 1 }
            );

            business = businessResult.data;
          }
        }

        if (mountedRef.current) {
          if (business) {
            localStorage.setItem('current_business_id', business.id);
            localStorage.setItem('business_permalink', business.permalink);
            setTenantInfo({
              businessId: business.id,
              businessName: business.name,
              subdomain: business.subdomain,
              customDomain: business.custom_domain,
              planType: business.plan_type,
              isLoading: false,
            });
          } else {
            setTenantInfo({
              businessId: null,
              businessName: null,
              subdomain: null,
              customDomain: null,
              planType: 'starter',
              isLoading: false,
            });
          }
        }
      } catch (error) {
        console.error('Error fetching tenant info:', error);
        if (mountedRef.current) {
          setTenantInfo({
            businessId: null,
            businessName: null,
            subdomain: null,
            customDomain: null,
            planType: 'starter',
            isLoading: false,
          });
        }
      } finally {
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
          fetchTimeoutRef.current = null;
        }
      }
    }

    fetchTenantInfo();

    return () => {
      mountedRef.current = false;
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <TenantContext.Provider value={tenantInfo}>
      {children}
    </TenantContext.Provider>
  );
}
