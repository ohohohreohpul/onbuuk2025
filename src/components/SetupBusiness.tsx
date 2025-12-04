import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, AlertCircle } from 'lucide-react';

export function SetupBusiness() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    let mounted = true;
    let hasProcessed = false;

    const handleOAuthCallback = async (session: any) => {
      if (!mounted || hasProcessed) return;
      hasProcessed = true;
      setProcessed(true);

      try {
        const { data: existingAdmin } = await supabase
          .from('admin_users')
          .select('business_id, businesses(permalink)')
          .eq('user_id', session.user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (existingAdmin) {
          const permalink = (existingAdmin.businesses as any)?.permalink;
          localStorage.setItem('current_business_id', existingAdmin.business_id);
          if (permalink) {
            localStorage.setItem('business_permalink', permalink);
            window.location.href = `/${permalink}/admin`;
          } else {
            window.location.href = '/admin';
          }
          return;
        }

        const randomPermalink = `biz-${Math.random().toString(36).substring(2, 10)}`;

        const { data: business, error: businessError } = await supabase
          .from('businesses')
          .insert({
            name: null,
            permalink: randomPermalink,
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

        if (businessError) throw new Error(`Failed to create business: ${businessError.message}`);

        const { error: adminError } = await supabase
          .from('admin_users')
          .insert({
            business_id: business.id,
            email: session.user.email,
            password_hash: null,
            full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || null,
            role: 'owner',
            is_owner: true,
            is_active: true,
            user_id: session.user.id,
          });

        if (adminError) throw new Error(`Failed to create admin user: ${adminError.message}`);

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

        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('*')
          .eq('email', session.user.email)
          .eq('business_id', business.id)
          .single();

        if (adminUser) {
          const adminUserData = {
            id: adminUser.id,
            email: adminUser.email,
            full_name: adminUser.full_name,
            role: adminUser.role,
            is_active: adminUser.is_active,
            business_id: adminUser.business_id,
            specialist_id: adminUser.specialist_id,
          };
          localStorage.setItem('admin_user', JSON.stringify(adminUserData));
        }

        localStorage.setItem('current_business_id', business.id);
        localStorage.setItem('business_permalink', business.permalink);

        await supabase.functions.invoke('send-platform-email', {
          body: {
            event_key: 'business_welcome',
            recipient_email: session.user.email,
            variables: {
              business_name: 'Your Business',
              owner_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || 'there',
              owner_email: session.user.email,
              permalink: `${window.location.origin}/${business.permalink}`,
              dashboard_url: `${window.location.origin}/${business.permalink}/admin`,
              setup_guide_url: '#',
            },
            business_id: business.id,
          },
        }).catch((err) => console.error('Failed to send welcome email:', err));

        window.location.href = '/admin';
      } catch (err) {
        console.error('Setup error:', err);
        setError(err instanceof Error ? err.message : 'Failed to create business account');
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted || hasProcessed) return;

        if (event === 'SIGNED_IN' && session) {
          await handleOAuthCallback(session);
        }
      }
    );

    const checkExistingSession = async () => {
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!mounted || hasProcessed) return;

      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        await handleOAuthCallback(session);
      } else {
        if (!hasProcessed) {
          window.location.href = '/signup';
        }
      }
    };

    checkExistingSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-3xl font-bold text-stone-900 mb-2">
              Setup Failed
            </h1>
            <p className="text-stone-600 mb-6">
              {error}
            </p>
            <button
              onClick={() => window.location.href = '/signup'}
              className="w-full bg-stone-900 text-white py-3 rounded-lg font-semibold hover:bg-stone-800 transition-colors"
            >
              Back to Sign Up
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-stone-900 animate-spin mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-stone-900 mb-2">
          Setting Up Your Account...
        </h2>
        <p className="text-stone-600">
          Creating your booking system
        </p>
      </div>
    </div>
  );
}
