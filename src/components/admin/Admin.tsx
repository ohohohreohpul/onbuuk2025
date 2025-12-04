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

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const [currentView, setCurrentView] = useState('dashboard');
  const processingOAuthRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const generateUniquePermalink = async (): Promise<string> => {
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        const randomPermalink = `biz-${Math.random().toString(36).substring(2, 10)}`;

        const { data: existing } = await supabase
          .from('businesses')
          .select('id')
          .eq('permalink', randomPermalink)
          .maybeSingle();

        if (!existing) {
          return randomPermalink;
        }

        attempts++;
      }

      return `biz-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    };

    const handleOAuthCallback = async (session: any) => {
      if (!mounted || processingOAuthRef.current) return;
      processingOAuthRef.current = true;

      try {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id, business_id, role, full_name, businesses(permalink)')
          .eq('email', session.user.email)
          .eq('is_active', true)
          .maybeSingle();

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

          await supabase
            .from('admin_users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', adminUser.id);

          window.history.replaceState({}, document.title, '/admin');

          if (mounted) {
            setIsAuthenticated(true);
            setLoading(false);
          }
        } else {
          if (mounted) {
            setLoadingMessage('Setting up your account...');
          }

          const { data: existingAuthUser } = await supabase
            .from('admin_users')
            .select('id, email')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (existingAuthUser) {
            throw new Error('An account already exists with this Google account.');
          }

          const uniquePermalink = await generateUniquePermalink();
          const fullName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User';

          const { data: business, error: businessError } = await supabase
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
            .single();

          if (businessError) {
            if (businessError.code === '23505') {
              throw new Error('Unable to create unique business permalink. Please try again.');
            }
            throw new Error(`Failed to create business: ${businessError.message}`);
          }

          const { error: adminError } = await supabase
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
            });

          if (adminError) {
            if (adminError.code === '23505') {
              throw new Error('An account with this email already exists.');
            }
            throw new Error(`Failed to create admin user: ${adminError.message}`);
          }

          await supabase.from('booking_form_colors').insert([
            { business_id: business.id, color_key: 'primary', color_value: '#1c1917' },
            { business_id: business.id, color_key: 'primary_hover', color_value: '#44403c' },
            { business_id: business.id, color_key: 'secondary', color_value: '#78716c' },
            { business_id: business.id, color_key: 'text_primary', color_value: '#1c1917' },
            { business_id: business.id, color_key: 'text_secondary', color_value: '#57534e' },
            { business_id: business.id, color_key: 'background', color_value: '#ffffff' },
            { business_id: business.id, color_key: 'background_secondary', color_value: '#fafaf9' },
            { business_id: business.id, color_key: 'border', color_value: '#e7e5e4' },
            { business_id: business.id, color_key: 'accent', color_value: '#1c1917' },
          ]);

          const { data: newAdminUser } = await supabase
            .from('admin_users')
            .select('*')
            .eq('email', session.user.email)
            .eq('business_id', business.id)
            .single();

          if (newAdminUser) {
            const adminUserData = {
              id: newAdminUser.id,
              email: newAdminUser.email,
              full_name: newAdminUser.full_name,
              role: newAdminUser.role,
              is_active: newAdminUser.is_active,
              business_id: newAdminUser.business_id,
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
        await supabase.auth.signOut();
        if (mounted) {
          window.location.href = '/login?error=' + encodeURIComponent(err.message || 'Failed to complete sign in');
        }
      } finally {
        processingOAuthRef.current = false;
      }
    };

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          window.location.href = '/login';
          return;
        }

        await handleOAuthCallback(session);
      } catch (err) {
        console.error('Auth check error:', err);
        window.location.href = '/login';
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session && !processingOAuthRef.current) {
        await handleOAuthCallback(session);
      } else if (event === 'SIGNED_OUT') {
        window.location.href = '/login';
      }
    });

    checkAuth();

    return () => {
      mounted = false;
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
