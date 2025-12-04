import { useState, useEffect } from 'react';
import { TenantContext, TenantInfo, extractSubdomain, extractCustomDomain } from '../lib/tenantContext';
import { supabase } from '../lib/supabase';

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

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenantInfo, setTenantInfo] = useState<TenantInfo>({
    businessId: null,
    businessName: null,
    subdomain: null,
    customDomain: null,
    planType: 'starter',
    isLoading: true,
  });

  useEffect(() => {
    async function fetchTenantInfo() {
      let business = null;
      const currentPath = window.location.pathname;
      const hostname = window.location.hostname;
      const isAdminRoute = currentPath === '/admin' || currentPath.includes('/admin');

      // First, check if accessing via custom domain
      if (!isAdminRoute) {
        const { data: customDomain } = await supabase
          .from('custom_domains')
          .select('business_id, businesses(*)')
          .eq('domain', hostname)
          .eq('status', 'verified')
          .eq('dns_configured', true)
          .maybeSingle();

        if (customDomain?.businesses) {
          business = customDomain.businesses;
        }
      }

      // If not found via custom domain, proceed with existing logic
      if (!business && isAdminRoute) {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data: adminUser } = await supabase
            .from('admin_users')
            .select('business_id')
            .eq('email', user.email)
            .eq('is_active', true)
            .maybeSingle();

          if (adminUser?.business_id) {
            const { data } = await supabase
              .from('businesses')
              .select('*')
              .eq('id', adminUser.business_id)
              .eq('is_active', true)
              .maybeSingle();

            business = data;
          }
        }

        if (!business) {
          const storedBusinessId = localStorage.getItem('current_business_id');
          if (storedBusinessId) {
            const { data } = await supabase
              .from('businesses')
              .select('*')
              .eq('id', storedBusinessId)
              .eq('is_active', true)
              .maybeSingle();

            business = data;
          }
        }
      } else if (!business) {
        const pathParts = currentPath.split('/').filter(p => p);
        const firstSegment = pathParts[0];

        const isReservedRoute = firstSegment && RESERVED_ROUTES.includes(firstSegment);
        const permalinkFromUrl = firstSegment && !isReservedRoute ? firstSegment : null;

        if (permalinkFromUrl) {
          const { data } = await supabase
            .from('businesses')
            .select('*')
            .eq('permalink', permalinkFromUrl)
            .eq('is_active', true)
            .maybeSingle();

          business = data;
        }
      }

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

    fetchTenantInfo();
  }, []);

  return (
    <TenantContext.Provider value={tenantInfo}>
      {children}
    </TenantContext.Provider>
  );
}
