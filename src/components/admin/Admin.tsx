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
import { LoyaltyRewardsView } from './LoyaltyRewardsView';
import NoShowFeesView from './NoShowFeesView';
import ProductsView from './ProductsView';
import { adminAuth } from '../../lib/adminAuth';
import { supabase } from '../../lib/supabase';
import { executeWithTimeout } from '../../lib/queryUtils';

const AUTH_CHECK_TIMEOUT = 15000;
const OAUTH_PROCESSING_TIMEOUT = 60000;

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

    const generateUniquePermalink = (): string => {
      return `biz-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
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
            .select('id, business_id, role, full_name')
            .eq('email', session.user.email)
            .eq('is_active', true)
            .maybeSingle(),
          { timeout: 10000, retries: 3 }
        );

        if (adminUserResult.error) {
          throw new Error(adminUserResult.error.message);
        }

        const adminUser = adminUserResult.data;
        let permalink = null;

        if (adminUser) {
          const businessResult = await executeWithTimeout(
            supabase
              .from('businesses')
              .select('permalink')
              .eq('id', adminUser.business_id)
              .maybeSingle(),
            { timeout: 5000, retries: 2 }
          );
          permalink = businessResult.data?.permalink;
        }

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

          if (permalink) {
            localStorage.setItem('business_permalink', permalink);
          }

          executeWithTimeout(
            supabase
              .from('admin_users')
              .update({ last_login: new Date().toISOString() })
              .eq('id', adminUser.id),
            { timeout: 8000, retries: 1 }
          ).catch(err => console.error('Failed to update last login:', err));

          window.history.replaceState({}, document.title, '/admin');

          if (authCheckTimeoutRef.current) {
            clearTimeout(authCheckTimeoutRef.current);
            authCheckTimeoutRef.current = null;
          }

          if (mounted) {
            setIsAuthenticated(true);
            setLoading(false);
          }
        } else {
          if (mounted) {
            setLoadingMessage('Setting up your account...');
            setLoading(true);
          }

          const uniquePermalink = generateUniquePermalink();
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
            { timeout: 15000, retries: 3 }
          );

          if (businessResult.error) {
            if (businessResult.error.message?.includes('23505')) {
              throw new Error('Unable to create unique business permalink. Please try again.');
            }
            throw businessResult.error;
          }

          const business = businessResult.data;

          const [adminInsertResult, colorResult] = await Promise.all([
            executeWithTimeout(
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
                })
                .select()
                .single(),
              { timeout: 12000, retries: 3 }
            ),
            executeWithTimeout(
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
              { timeout: 10000, retries: 2 }
            ),
          ]);

          if (adminInsertResult.error) {
            if (adminInsertResult.error.message?.includes('23505')) {
              throw new Error('An account with this email already exists.');
            }
            throw adminInsertResult.error;
          }

          if (colorResult.error) {
            console.error('Failed to insert default colors:', colorResult.error);
            throw new Error('Failed to initialize booking colors. Please try again.');
          }

          const adminUserData = {
            id: adminInsertResult.data.id,
            email: adminInsertResult.data.email,
            full_name: adminInsertResult.data.full_name,
            role: adminInsertResult.data.role,
            is_active: adminInsertResult.data.is_active,
            business_id: adminInsertResult.data.business_id,
          };
          localStorage.setItem('admin_user', JSON.stringify(adminUserData));

          localStorage.setItem('current_business_id', business.id);
          localStorage.setItem('business_permalink', business.permalink);

          window.history.replaceState({}, document.title, '/admin');

          if (authCheckTimeoutRef.current) {
            clearTimeout(authCheckTimeoutRef.current);
            authCheckTimeoutRef.current = null;
          }

          if (mounted) {
            setIsAuthenticated(true);
            setLoading(false);
          }
        }
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        clearTimeout(oauthTimeout);
        processingOAuthRef.current = false;

        if (mounted) {
          setLoading(false);
          setIsAuthenticated(false);
        }

        await supabase.auth.signOut().catch(e => console.error('Failed to sign out:', e));

        if (mounted) {
          setTimeout(() => {
            window.location.href = '/login?error=' + encodeURIComponent(err.message || 'Failed to complete sign in');
          }, 100);
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
            setTimeout(() => reject(new Error('Session check timeout')), 8000)
          )
        ]);

        if (!session) {
          if (mounted) {
            setLoading(false);
            window.location.href = '/login';
          }
          return;
        }

        await handleOAuthCallback(session);
      } catch (err: any) {
        console.error('Auth check error:', err);
        if (mounted) {
          setLoading(false);
          if (err.message === 'Session check timeout') {
            window.location.href = '/login?error=timeout';
          } else {
            window.location.href = '/login';
          }
        }
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session && !processingOAuthRef.current && mounted) {
        (async () => {
          await handleOAuthCallback(session);
        })();
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

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50" key="loading-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-stone-900 mx-auto mb-4" style={{ willChange: 'transform' }}></div>
          <div className="text-stone-600">{loadingMessage || 'Loading...'}</div>
        </div>
      </div>
    );
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
