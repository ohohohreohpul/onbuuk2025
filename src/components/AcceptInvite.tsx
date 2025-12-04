import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader2, Lock, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface InvitationDetails {
  id: string;
  business_id: string;
  email: string;
  full_name: string;
  role: string;
  expires_at: string;
  businesses?: {
    business_name: string;
    logo_url?: string;
  };
}

export function AcceptInvite() {
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    fetchInvitation(token);
  }, []);

  const fetchInvitation = async (token: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('staff_invitations')
        .select(`
          id,
          business_id,
          email,
          full_name,
          role,
          expires_at,
          businesses (
            business_name,
            logo_url
          )
        `)
        .eq('invite_token', token)
        .eq('is_used', false)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        setError('This invitation link is invalid or has already been used.');
        setLoading(false);
        return;
      }

      const expiresAt = new Date(data.expires_at);
      if (expiresAt < new Date()) {
        setError('This invitation has expired. Please contact your administrator for a new invitation.');
        setLoading(false);
        return;
      }

      setInvitation(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching invitation:', err);
      setError('Failed to load invitation details. Please try again.');
      setLoading(false);
    }
  };

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(pwd)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(pwd)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!invitation) return;

    setAccepting(true);

    try {
      const token = new URLSearchParams(window.location.search).get('token');
      if (!token) throw new Error('Missing token');

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invitation.email,
        password: password,
        options: {
          data: {
            full_name: invitation.full_name,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user account');

      const { data: acceptResult, error: acceptError } = await supabase.rpc(
        'accept_staff_invitation',
        {
          p_invite_token: token,
          p_password: password,
        }
      );

      if (acceptError) throw acceptError;

      setSuccess(true);

      setTimeout(() => {
        window.location.href = '/login';
      }, 3000);
    } catch (err: any) {
      console.error('Error accepting invitation:', err);
      setError(err.message || 'Failed to accept invitation. Please try again.');
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading invitation...</span>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white shadow-xl p-8">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Invalid Invitation</h1>
            <p className="text-slate-600 mb-6">{error}</p>
            <a
              href="/"
              className="inline-block px-6 py-3 bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors"
            >
              Go to Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white shadow-xl p-8">
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome Aboard!</h1>
            <p className="text-slate-600 mb-4">
              Your account has been created successfully. You're now part of{' '}
              <span className="font-semibold">{(invitation?.businesses as any)?.business_name}</span>.
            </p>
            <p className="text-sm text-slate-500">Redirecting you to login...</p>
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
            {(invitation?.businesses as any)?.logo_url && (
              <img
                src={(invitation.businesses as any).logo_url}
                alt="Business logo"
                className="h-12 mx-auto mb-4"
              />
            )}
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Join {(invitation?.businesses as any)?.business_name}
            </h1>
            <p className="text-slate-600">
              You've been invited to join as a <span className="font-semibold capitalize">{invitation?.role}</span>
            </p>
          </div>

          <div className="bg-slate-50 p-4 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <User className="w-5 h-5 text-slate-600" />
              <div>
                <div className="text-sm text-slate-500">Name</div>
                <div className="font-medium text-slate-900">{invitation?.full_name}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div>
                <div className="text-sm text-slate-500">Email</div>
                <div className="font-medium text-slate-900">{invitation?.email}</div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleAccept} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Create Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  placeholder="Enter a strong password"
                  required
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Must be at least 8 characters with uppercase, lowercase, and numbers
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
                  placeholder="Confirm your password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={accepting}
              className="w-full bg-slate-900 text-white py-3 font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {accepting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Accept Invitation & Create Account'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
