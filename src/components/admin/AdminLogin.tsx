import { useState, useEffect } from 'react';
import { Lock, Mail } from 'lucide-react';
import { adminAuth } from '../../lib/adminAuth';
import { useTenant } from '../../lib/tenantContext';
import { supabase } from '../../lib/supabase';
import { BRAND_LOGO, BRAND_NAME } from '../../lib/brand';
import { useAdminText } from '../../lib/adminLanguage';
import type { Translations } from '../../lib/bookingLanguage';

const TEXT: Translations<{
  portal: string; email: string; password: string; passwordPlaceholder: string; signingIn: string; signIn: string;
  noAccount: string; signUp: string; invalidCredentials: string; loginFailed: string;
}> = {
  en: {
    portal: 'Admin Portal', email: 'Email', password: 'Password', passwordPlaceholder: 'Enter your password',
    signingIn: 'Logging in...', signIn: 'Login', noAccount: "Don't have an account?", signUp: 'Sign up',
    invalidCredentials: 'Invalid credentials', loginFailed: 'Login failed. Please try again.',
  },
  de: {
    portal: 'Admin-Bereich', email: 'E-Mail', password: 'Passwort', passwordPlaceholder: 'Passwort eingeben',
    signingIn: 'Anmeldung läuft…', signIn: 'Anmelden', noAccount: 'Noch kein Konto?', signUp: 'Registrieren',
    invalidCredentials: 'E-Mail oder Passwort ist falsch', loginFailed: 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.',
  },
  th: {
    portal: 'ระบบผู้ดูแล', email: 'อีเมล', password: 'รหัสผ่าน', passwordPlaceholder: 'กรอกรหัสผ่าน',
    signingIn: 'กำลังเข้าสู่ระบบ…', signIn: 'เข้าสู่ระบบ', noAccount: 'ยังไม่มีบัญชี?', signUp: 'สมัครใช้งาน',
    invalidCredentials: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', loginFailed: 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง',
  },
};

type LoginError = '' | 'invalidCredentials' | 'loginFailed';

interface AdminLoginProps {
  onLoginSuccess: () => void;
}

export default function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const { t } = useAdminText(TEXT);
  const tenant = useTenant();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<LoginError>('');
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLogo() {
      if (!tenant.businessId) {
        setLogoUrl(BRAND_LOGO);
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
        setLogoUrl(BRAND_LOGO);
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
        setError('invalidCredentials');
      }
    } catch (err) {
      setError('loginFailed');
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
                {tenant.businessName || BRAND_NAME}
              </div>
            </div>
            <p className="text-stone-600 text-sm">{t.portal}</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm">
              {t[error]}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4" />
                  <span>{t.email}</span>
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
                  <span>{t.password}</span>
                </div>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800 transition-colors"
                placeholder={t.passwordPlaceholder}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-8 py-4 bg-stone-800 text-white text-sm tracking-wide hover:bg-stone-700 transition-colors duration-200 disabled:bg-stone-400 disabled:cursor-not-allowed"
            >
              {loading ? t.signingIn : t.signIn}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-stone-600">
              {t.noAccount}{' '}
              <a href="/register" className="text-stone-900 font-semibold hover:underline">
                {t.signUp}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
