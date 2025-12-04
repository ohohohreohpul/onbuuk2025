import { useState, useEffect } from 'react';
import { Lock, Mail } from 'lucide-react';
import { adminAuth } from '../../lib/adminAuth';
import { useTenant } from '../../lib/tenantContext';
import { supabase } from '../../lib/supabase';

interface AdminLoginProps {
  onLoginSuccess: () => void;
}

export default function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const tenant = useTenant();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLogo() {
      if (!tenant.businessId) {
        setLogoUrl('/blbuuklogo.png');
        return;
      }

      const { data } = await supabase
        .from('businesses')
        .select('login_page_logo_url, custom_logo_url, logo_url')
        .eq('id', tenant.businessId)
        .maybeSingle();

      if (data?.login_page_logo_url) {
        setLogoUrl(data.login_page_logo_url);
      } else {
        setLogoUrl('/blbuuklogo.png');
      }
    }

    fetchLogo();
  }, [tenant.businessId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let businessId = tenant.businessId;

      if (!businessId) {
        const storedBusinessId = localStorage.getItem('current_business_id');
        if (storedBusinessId) {
          businessId = storedBusinessId;
        }
      }

      const user = await adminAuth.login(email, password, businessId);
      if (user) {
        onLoginSuccess();
      } else {
        setError('Invalid credentials');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="text-4xl font-bold text-stone-800">
                {tenant.businessName || 'Buuk'}
              </div>
            </div>
            <p className="text-stone-600 text-sm">Admin Portal</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4" />
                  <span>Email</span>
                </div>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800 transition-colors"
                placeholder="your@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                <div className="flex items-center space-x-2">
                  <Lock className="w-4 h-4" />
                  <span>Password</span>
                </div>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800 transition-colors"
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-8 py-4 bg-stone-800 text-white text-sm tracking-wide hover:bg-stone-700 transition-colors duration-200 disabled:bg-stone-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-stone-600">
              Don't have an account?{' '}
              <a href="/register" className="text-stone-900 font-semibold hover:underline">
                Sign up
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
