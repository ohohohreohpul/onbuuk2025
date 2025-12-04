import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, ArrowRight } from 'lucide-react';

export function BusinessRegistration() {
  const [formData, setFormData] = useState({
    businessName: '',
    businessType: 'salon',
    phone: '',
    address: '',
    adminEmail: '',
    adminPassword: '',
    adminFullName: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.adminEmail,
        password: formData.adminPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/admin`,
          data: {
            full_name: formData.adminFullName,
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
          name: formData.businessName,
          permalink: randomPermalink,
          business_type: formData.businessType,
          phone: formData.phone,
          address: formData.address,
          plan_type: 'free',
          is_active: true,
          owner_id: authData.user.id,
          custom_logo_url: '/defbuuklogo.png',
        })
        .select()
        .single();

      if (businessError) throw new Error(`Failed to create business: ${businessError.message}`);

      const { error: adminError } = await supabase
        .from('admin_users')
        .insert({
          business_id: business.id,
          email: formData.adminEmail,
          password_hash: null,
          full_name: formData.adminFullName,
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
        .eq('email', formData.adminEmail)
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
          recipient_email: formData.adminEmail,
          variables: {
            business_name: formData.businessName,
            owner_name: formData.adminFullName,
            owner_email: formData.adminEmail,
            permalink: `${window.location.origin}/${business.permalink}`,
            dashboard_url: `${window.location.origin}/${business.permalink}/admin`,
            setup_guide_url: '#',
          },
          business_id: business.id,
        },
      }).catch((err) => console.error('Failed to send welcome email:', err));

      setSuccess(true);
      setTimeout(() => {
        window.location.href = `/${business.permalink}/admin`;
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create business');
    } finally {
      setIsSubmitting(false);
    }
  };


  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-stone-900 mb-2">Business Created!</h2>
          <p className="text-stone-600 mb-4">
            Your booking system is ready. Redirecting you to the admin panel...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-stone-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-stone-900 mb-2">Create Your Booking System</h1>
          <p className="text-stone-600">Set up your business in minutes</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Business Name
            </label>
            <input
              type="text"
              required
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              placeholder="My Awesome Business"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Business Type
            </label>
            <select
              required
              value={formData.businessType}
              onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent bg-white"
            >
              <option value="salon">Salon</option>
              <option value="spa">Spa</option>
              <option value="massage_studio">Massage Studio</option>
              <option value="barbershop">Barbershop</option>
              <option value="nail_salon">Nail Salon</option>
              <option value="wellness_center">Wellness Center</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Address
            </label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              placeholder="123 Main St, City, State 12345"
            />
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-stone-900 mb-4">Admin Account</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.adminFullName}
                  onChange={(e) => setFormData({ ...formData, adminFullName: e.target.value })}
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
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                  placeholder="admin@example.com"
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
                  value={formData.adminPassword}
                  onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                  className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                  placeholder="Min 8 characters"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-stone-900 text-white py-3 rounded-lg font-semibold hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? 'Creating...' : 'Create Business'}
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
