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
  'booking-success',
  'gift-card-success',
  'payment-cancelled',
];

const TENANT_FETCH_TIMEOUT = 15000; // Increased timeout
const MAX_RETRIES = 3; // Increased retries

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
  const retryCountRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;

    async function fetchTenantInfo() {
      const abortController = new AbortController();

      fetchTimeoutRef.current = setTimeout(() => {
        abortController.abort();
        if (mountedRef.current) {
          console.error('Tenant fetch timeout - loading without business context');
          // Try to use cached data as fallback
          const cachedBusinessId = localStorage.getItem('current_business_id');
          const cachedPermalink = localStorage.getItem('business_permalink');
          
          if (cachedBusinessId && cachedPermalink) {
            // Verify the cached data matches the current URL
            const currentPath = window.location.pathname;
            const pathParts = currentPath.split('/').filter(p => p);
            const firstSegment = pathParts[0];
            
            if (firstSegment === cachedPermalink || RESERVED_ROUTES.includes(firstSegment || '')) {
              setTenantInfo({
                businessId: cachedBusinessId,
                businessName: null,
                subdomain: cachedPermalink,
                customDomain: null,
                planType: 'starter',
                isLoading: false,
              });
              return;
            }
          }
          
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

        if (isAdminRoute) {
          try {
            const { data: { user } } = await Promise.race([
              supabase.auth.getUser(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Auth timeout')), 5000)
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
                { timeout: 5000, retries: 2 }
              );

              if (adminUserResult.data?.business_id) {
                const businessResult = await executeWithTimeout(
                  supabase
                    .from('businesses')
                    .select('*')
                    .eq('id', adminUserResult.data.business_id)
                    .eq('is_active', true)
                    .maybeSingle(),
                  { timeout: 5000, retries: 2 }
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
                { timeout: 5000, retries: 2 }
              );

              business = businessResult.data;
            }
          }
        } else if (!business) {
          // First try to lookup by custom domain
          const customDomain = extractCustomDomain(hostname);
          if (customDomain && customDomain !== 'onbuuk.com') {
            const businessResult = await executeWithTimeout(
              supabase
                .from('businesses')
                .select('*')
                .eq('custom_domain', customDomain)
                .eq('is_active', true)
                .maybeSingle(),
              { timeout: 5000, retries: 2 }
            );

            business = businessResult.data;
          }

          // If not found by custom domain, try permalink from URL
          if (!business) {
            const pathParts = currentPath.split('/').filter(p => p);
            const firstSegment = pathParts[0];

            const isReservedRoute = firstSegment && RESERVED_ROUTES.includes(firstSegment);
            const permalinkFromUrl = firstSegment && !isReservedRoute ? firstSegment : null;

            if (permalinkFromUrl) {
              // Try multiple times with increasing delays for permalink lookup
              let businessResult = await executeWithTimeout(
                supabase
                  .from('businesses')
                  .select('*')
                  .eq('permalink', permalinkFromUrl)
                  .eq('is_active', true)
                  .maybeSingle(),
                { timeout: 5000, retries: MAX_RETRIES, retryDelay: 1000 }
              );

              business = businessResult.data;
              
              // If still not found, try one more time with a fresh query
              if (!business && retryCountRef.current < 2) {
                retryCountRef.current++;
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                businessResult = await executeWithTimeout(
                  supabase
                    .from('businesses')
                    .select('*')
                    .eq('permalink', permalinkFromUrl)
                    .eq('is_active', true)
                    .maybeSingle(),
                  { timeout: 8000, retries: 2, retryDelay: 1500 }
                );
                
                business = businessResult.data;
              }
            }
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
            // Before showing 404, check if we have valid cached data
            const cachedBusinessId = localStorage.getItem('current_business_id');
            const cachedPermalink = localStorage.getItem('business_permalink');
            const pathParts = currentPath.split('/').filter(p => p);
            const firstSegment = pathParts[0];
            
            // If cached permalink matches URL, use cached data and retry in background
            if (cachedBusinessId && cachedPermalink && firstSegment === cachedPermalink) {
              console.log('Using cached business data while retrying...');
              setTenantInfo({
                businessId: cachedBusinessId,
                businessName: null,
                subdomain: cachedPermalink,
                customDomain: null,
                planType: 'starter',
                isLoading: false,
              });
              
              // Retry fetching in background
              setTimeout(async () => {
                const retryResult = await executeWithTimeout(
                  supabase
                    .from('businesses')
                    .select('*')
                    .eq('permalink', firstSegment)
                    .eq('is_active', true)
                    .maybeSingle(),
                  { timeout: 10000, retries: 3 }
                );
                
                if (retryResult.data && mountedRef.current) {
                  setTenantInfo({
                    businessId: retryResult.data.id,
                    businessName: retryResult.data.name,
                    subdomain: retryResult.data.subdomain,
                    customDomain: retryResult.data.custom_domain,
                    planType: retryResult.data.plan_type,
                    isLoading: false,
                  });
                }
              }, 2000);
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
        }
      } catch (error) {
        console.error('Error fetching tenant info:', error);
        if (mountedRef.current) {
          // Try cached data on error
          const cachedBusinessId = localStorage.getItem('current_business_id');
          const cachedPermalink = localStorage.getItem('business_permalink');
          const currentPath = window.location.pathname;
          const pathParts = currentPath.split('/').filter(p => p);
          const firstSegment = pathParts[0];
          
          if (cachedBusinessId && cachedPermalink && firstSegment === cachedPermalink) {
            setTenantInfo({
              businessId: cachedBusinessId,
              businessName: null,
              subdomain: cachedPermalink,
              customDomain: null,
              planType: 'starter',
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
