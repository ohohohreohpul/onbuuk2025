import { useState, useEffect } from 'react';
import { Lock, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validToken, setValidToken] = useState(false);
  const [isMagicLink, setIsMagicLink] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const hash = window.location.hash;
      const isMagicLinkAuth = hash.includes('type=magiclink');
      setIsMagicLink(isMagicLinkAuth);

      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        setValidToken(true);

        if (isMagicLinkAuth) {
          const { data: adminUser } = await supabase
            .from('admin_users')
            .select('id, business_id, role, full_name, businesses(permalink)')
            .eq('user_id', session.user.id)
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

            setTimeout(() => {
              window.location.href = '/admin';
            }, 1500);
            return;
          }
        }
      } else {
        setError('Invalid or expired reset link. Please request a new one.');
      }
    } catch (err) {
      setError('Failed to verify reset link.');
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setSuccess(true);

      setTimeout(() => {
        window.location.href = '/login';
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-slate-900 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">
            {isMagicLink ? 'Signing you in...' : 'Verifying reset link...'}
          </p>
        </div>
      </div>
    );
  }

  if (!validToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white shadow-xl p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Invalid Reset Link
              </h1>
              <p className="text-slate-600 mb-6">
                {error || 'This password reset link is invalid or has expired.'}
              </p>
              <a
                href="/forgot-password"
                className="inline-block w-full bg-slate-900 text-white py-3 font-semibold hover:bg-slate-800 transition-colors text-center"
              >
                Request New Reset Link
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success || (isMagicLink && validToken)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white shadow-xl p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                {isMagicLink ? 'Signed In Successfully!' : 'Password Reset!'}
              </h1>
              <p className="text-slate-600 mb-6">
                {isMagicLink
                  ? 'Welcome back! Redirecting you to your dashboard...'
                  : 'Your password has been successfully reset.'
                }
              </p>
              <p className="text-sm text-slate-500 mb-6">
                {isMagicLink
                  ? 'Taking you to your dashboard...'
                  : 'Redirecting you to sign in...'
                }
              </p>
              <a
                href={isMagicLink ? '/admin' : '/login'}
                className="inline-block w-full bg-slate-900 text-white py-3 font-semibold hover:bg-slate-800 transition-colors text-center"
              >
                {isMagicLink ? 'Continue to Dashboard' : 'Continue to Sign In'}
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Reset Your Password
            </h1>
            <p className="text-slate-600">
              Choose a new password for your account
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  placeholder="Enter new password"
                  minLength={8}
                  required
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Must be at least 8 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  placeholder="Confirm new password"
                  minLength={8}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-3 font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Resetting Password...
                </>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
