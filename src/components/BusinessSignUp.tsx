import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, ArrowRight, Mail, Loader2 } from 'lucide-react';

export function BusinessSignUp() {
  const [mode, setMode] = useState<'choice' | 'email'>('choice');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, []);

  const handleGoogleSignUp = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/admin`,
        },
      });

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google');
      setIsSubmitting(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/admin`,
          data: {
            full_name: formData.fullName,
            business_name: formData.businessName,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Failed to create user account');

      if (authData.user.identities && authData.user.identities.length === 0) {
        throw new Error('This email is already registered. Please use a different email or sign in.');
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
          owner_id: authData.user.id,
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
          email: formData.email,
          password_hash: null,
          full_name: formData.fullName,
          role: 'owner',
          is_owner: true,
          is_active: true,
          user_id: authData.user.id,
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
        .eq('email', formData.email)
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

      setIsSubmitting(false);
      window.location.href = '/admin';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
      setIsSubmitting(false);
    }
  };


  if (mode === 'choice') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-stone-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-stone-900 mb-2">Create Your Booking System</h1>
            <p className="text-stone-600">Choose how you'd like to sign up</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleGoogleSignUp}
              disabled={isSubmitting}
              className="w-full bg-white border-2 border-stone-300 text-stone-900 py-3 rounded-lg font-semibold hover:bg-stone-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-stone-500">or</span>
              </div>
            </div>

            <button
              onClick={() => setMode('email')}
              className="w-full bg-stone-900 text-white py-3 rounded-lg font-semibold hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
            >
              <Mail className="w-5 h-5" />
              Continue with Email
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-stone-600">
            Already have an account?{' '}
            <a href="/admin" className="text-stone-900 font-semibold hover:underline">
              Sign in
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <button
            onClick={() => setMode('choice')}
            className="text-stone-600 hover:text-stone-900 text-sm mb-4"
          >
            ← Back
          </button>
          <div className="w-16 h-16 bg-stone-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-stone-900 mb-2">Create Your Account</h1>
          <p className="text-stone-600">Get started in seconds</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailSignUp} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Full Name
            </label>
            <input
              type="text"
              required
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              placeholder="Min 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-stone-900 text-white py-3 rounded-lg font-semibold hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? 'Creating Account...' : 'Create Account'}
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-600">
          Already have an account?{' '}
          <a href="/admin" className="text-stone-900 font-semibold hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
