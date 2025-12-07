import { useState, useEffect, useRef } from 'react';
import AdminLayout from './AdminLayout';
import DashboardView from './DashboardView';
import BookingsView from './BookingsView';
import CustomersView from './CustomersView';
import ServicesView from './ServicesView';
import SpecialistsView from './SpecialistsView';
import TeamManagementView from './TeamManagementView';
import SettingsView from './SettingsView';
import CalendarView from './CalendarView';
import BookingFormCustomization from './BookingFormCustomization';
import { LoyaltyRewardsView } from './LoyaltyRewardsView';
import NoShowFeesView from './NoShowFeesView';
import ProductsView from './ProductsView';
import { adminAuth } from '../../lib/adminAuth';
import { supabase } from '../../lib/supabase';
import { executeWithTimeout } from '../../lib/queryUtils';

const AUTH_CHECK_TIMEOUT = 10000;
const OAUTH_PROCESSING_TIMEOUT = 15000;

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const [currentView, setCurrentView] = useState('dashboard');
  const processingOAuthRef = useRef(false);
  const authCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    let mounted = true;
    mountedRef.current = true;

    authCheckTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current && loading) {
        console.error('Auth check timeout - redirecting to login');
        window.location.href = '/login?error=timeout';
      }
    }, AUTH_CHECK_TIMEOUT);

    const generateUniquePermalink = async (): Promise<string> => {
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        const randomPermalink = `biz-${Math.random().toString(36).substring(2, 10)}`;

        const result = await executeWithTimeout(
          supabase
            .from('businesses')
            .select('id')
            .eq('permalink', randomPermalink)
            .maybeSingle(),
          { timeout: 3000, retries: 1 }
        );

        if (!result.data) {
          return randomPermalink;
        }

        attempts++;
      }

      return `biz-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    };

    const handleOAuthCallback = async (session: any) => {
      if (!mounted || processingOAuthRef.current) return;
      processingOAuthRef.current = true;

      const oauthTimeout = setTimeout(() => {
        if (processingOAuthRef.current && mounted) {
          console.error('OAuth processing timeout');
          processingOAuthRef.current = false;
          window.location.href = '/login?error=oauth_timeout';
        }
      }, OAUTH_PROCESSING_TIMEOUT);

      try {
        const adminUserResult = await executeWithTimeout(
          supabase
            .from('admin_users')
            .select('id, business_id, role, full_name, businesses(permalink)')
            .eq('email', session.user.email)
            .eq('is_active', true)
            .maybeSingle(),
          { timeout: 5000, retries: 2 }
        );

        if (adminUserResult.error) {
          throw new Error(adminUserResult.error.message);
        }

        const adminUser = adminUserResult.data;

        clearTimeout(oauthTimeout);

        if (adminUser) {
          const adminUserData = {
            id: adminUser.id,
            email: session.user.email,
            full_name: adminUser.full_name,
            role: adminUser.role,
            is_active: true,
            business_id: adminUser.business_id,
          };

          localStorage.setItem('admin_user', JSON.stringify(adminUserData));
          localStorage.setItem('current_business_id', adminUser.business_id);

          const permalink = (adminUser.businesses as any)?.permalink;
          if (permalink) {
            localStorage.setItem('business_permalink', permalink);
          }

          await executeWithTimeout(
            supabase
              .from('admin_users')
              .update({ last_login: new Date().toISOString() })
              .eq('id', adminUser.id),
            { timeout: 3000, retries: 0 }
          );

          window.history.replaceState({}, document.title, '/admin');

          if (mounted) {
            setIsAuthenticated(true);
            setLoading(false);
          }
        } else {
          if (mounted) {
            setLoadingMessage('Setting up your account...');
          }

          const existingUserResult = await executeWithTimeout(
            supabase
              .from('admin_users')
              .select('id, email')
              .eq('user_id', session.user.id)
              .maybeSingle(),
            { timeout: 3000, retries: 1 }
          );

          if (existingUserResult.data) {
            throw new Error('An account already exists with this Google account.');
          }

          const uniquePermalink = await generateUniquePermalink();
          const fullName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User';

          const businessResult = await executeWithTimeout(
            supabase
              .from('businesses')
              .insert({
                name: null,
                permalink: uniquePermalink,
                business_type: null,
                phone: null,
                address: null,
                plan_type: 'free',
                is_active: true,
                owner_id: session.user.id,
                custom_logo_url: '/defbuuklogo.png',
                profile_completed: false,
              })
              .select()
              .single(),
            { timeout: 5000, retries: 1 }
          );

          if (businessResult.error) {
            if (businessResult.error.message?.includes('23505')) {
              throw new Error('Unable to create unique business permalink. Please try again.');
            }
            throw businessResult.error;
          }

          const business = businessResult.data;

          const adminInsertResult = await executeWithTimeout(
            supabase
              .from('admin_users')
              .insert({
                business_id: business.id,
                email: session.user.email,
                password_hash: null,
                full_name: fullName,
                role: 'owner',
                is_owner: true,
                is_active: true,
                user_id: session.user.id,
              }),
            { timeout: 5000, retries: 1 }
          );

          if (adminInsertResult.error) {
            if (adminInsertResult.error.message?.includes('23505')) {
              throw new Error('An account with this email already exists.');
            }
            throw adminInsertResult.error;
          }

          await executeWithTimeout(
            supabase.from('booking_form_colors').insert([
              { business_id: business.id, color_key: 'primary', color_value: '#1c1917' },
              { business_id: business.id, color_key: 'primary_hover', color_value: '#44403c' },
              { business_id: business.id, color_key: 'secondary', color_value: '#78716c' },
              { business_id: business.id, color_key: 'text_primary', color_value: '#1c1917' },
              { business_id: business.id, color_key: 'text_secondary', color_value: '#57534e' },
              { business_id: business.id, color_key: 'background', color_value: '#ffffff' },
              { business_id: business.id, color_key: 'background_secondary', color_value: '#fafaf9' },
              { business_id: business.id, color_key: 'border', color_value: '#e7e5e4' },
              { business_id: business.id, color_key: 'accent', color_value: '#1c1917' },
            ]),
            { timeout: 5000, retries: 0 }
          );

          const newAdminResult = await executeWithTimeout(
            supabase
              .from('admin_users')
              .select('*')
              .eq('email', session.user.email)
              .eq('business_id', business.id)
              .single(),
            { timeout: 3000, retries: 1 }
          );

          if (newAdminResult.data) {
            const adminUserData = {
              id: newAdminResult.data.id,
              email: newAdminResult.data.email,
              full_name: newAdminResult.data.full_name,
              role: newAdminResult.data.role,
              is_active: newAdminResult.data.is_active,
              business_id: newAdminResult.data.business_id,
            };
            localStorage.setItem('admin_user', JSON.stringify(adminUserData));
          }

          localStorage.setItem('current_business_id', business.id);
          localStorage.setItem('business_permalink', business.permalink);

          window.history.replaceState({}, document.title, '/admin');

          if (mounted) {
            setIsAuthenticated(true);
            setLoading(false);
          }
        }
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        clearTimeout(oauthTimeout);
        await supabase.auth.signOut();
        if (mounted) {
          window.location.href = '/login?error=' + encodeURIComponent(err.message || 'Failed to complete sign in');
        }
      } finally {
        processingOAuthRef.current = false;
        clearTimeout(oauthTimeout);
      }
    };

    const checkAuth = async () => {
      try {
        const { data: { session } } = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Session check timeout')), 5000)
          )
        ]);

        if (!session) {
          if (mounted) {
            window.location.href = '/login';
          }
          return;
        }

        await handleOAuthCallback(session);
      } catch (err: any) {
        console.error('Auth check error:', err);
        if (mounted) {
          if (err.message === 'Session check timeout') {
            window.location.href = '/login?error=timeout';
          } else {
            window.location.href = '/login';
          }
        }
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session && !processingOAuthRef.current && mounted) {
        await handleOAuthCallback(session);
      } else if (event === 'SIGNED_OUT' && mounted) {
        window.location.href = '/login';
      }
    });

    checkAuth();

    return () => {
      mounted = false;
      mountedRef.current = false;
      if (authCheckTimeoutRef.current) {
        clearTimeout(authCheckTimeoutRef.current);
      }
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await adminAuth.logout();
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-stone-900 mx-auto mb-4"></div>
          <div className="text-stone-600">{loadingMessage}</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView onNavigate={setCurrentView} />;
      case 'calendar':
        return <CalendarView />;
      case 'bookings':
        return <BookingsView />;
      case 'customers':
        return <CustomersView />;
      case 'services':
        return <ServicesView />;
      case 'specialists':
        return <SpecialistsView />;
      case 'staff':
        return <TeamManagementView />;
      case 'loyalty':
        return <LoyaltyRewardsView />;
      case 'fees':
        return <NoShowFeesView />;
      case 'products':
        return <ProductsView />;
      case 'customize':
        return <BookingFormCustomization />;
      case 'settings':
        return <SettingsView />;
      case 'gift-cards':
        return <LoyaltyRewardsView />;
      default:
        return <DashboardView onNavigate={setCurrentView} />;
    }
  };

  return (
    <AdminLayout
      currentView={currentView}
      onViewChange={setCurrentView}
      onLogout={handleLogout}
    >
      {renderView()}
    </AdminLayout>
  );
}
