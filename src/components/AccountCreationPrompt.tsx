import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, UserPlus, X, Check, Gift } from 'lucide-react';

interface AccountCreationPromptProps {
  customerEmail: string;
  customerName: string;
  businessId: string;
}

export default function AccountCreationPrompt({
  customerEmail,
  customerName,
  businessId,
}: AccountCreationPromptProps) {
  const [showPrompt, setShowPrompt] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [error, setError] = useState('');

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsCreating(true);

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: customerEmail,
        password: password,
        options: {
          data: {
            full_name: customerName,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        const { error: updateError } = await supabase
          .from('customers')
          .update({ user_id: authData.user.id })
          .eq('business_id', businessId)
          .eq('email', customerEmail);

        if (updateError) {
          console.error('Error linking customer:', updateError);
        }

        setAccountCreated(true);
      }
    } catch (err: any) {
      console.error('Error creating account:', err);
      if (err.message?.includes('already registered')) {
        setError('An account with this email already exists');
      } else {
        setError(err.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  if (!showPrompt) return null;

  if (accountCreated) {
    return (
      <div className="border-2 border-green-200 bg-green-50 p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-green-900">Account Created Successfully!</h3>
              <p className="text-sm text-green-700 mt-1">
                You can now sign in to view your bookings and track your loyalty points.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowPrompt(false)}
            className="text-green-600 hover:text-green-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center justify-center">
          <a
            href="/account"
            className="inline-flex items-center space-x-2 px-6 py-3 bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            <span>Go to Customer Portal</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="border-2 border-stone-800 bg-stone-50 p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full bg-stone-800 flex items-center justify-center">
            <UserPlus className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-stone-800">Create Your Account</h3>
            <p className="text-sm text-stone-600 mt-1">
              Track your bookings and earn loyalty rewards
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowPrompt(false)}
          className="text-stone-400 hover:text-stone-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-start space-x-2 text-sm text-stone-600 bg-white p-3 border border-stone-200">
        <Gift className="w-5 h-5 text-stone-800 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-stone-800">Benefits of creating an account:</p>
          <ul className="mt-2 space-y-1 list-disc list-inside text-stone-600">
            <li>View all your bookings in one place</li>
            <li>Earn and redeem loyalty points</li>
            <li>Faster checkout next time</li>
            <li>Manage your preferences</li>
          </ul>
        </div>
      </div>

      <form onSubmit={handleCreateAccount} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            <Lock className="w-4 h-4 inline mr-1" />
            Create Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-stone-300 focus:outline-none focus:border-stone-800"
            placeholder="At least 6 characters"
            required
            disabled={isCreating}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 border border-stone-300 focus:outline-none focus:border-stone-800"
            placeholder="Re-enter your password"
            required
            disabled={isCreating}
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 border border-red-200">
            {error}
          </div>
        )}

        <div className="flex space-x-3">
          <button
            type="submit"
            disabled={isCreating}
            className="flex-1 px-6 py-3 bg-stone-800 text-white hover:bg-stone-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? 'Creating Account...' : 'Create Account'}
          </button>
          <button
            type="button"
            onClick={() => setShowPrompt(false)}
            className="px-6 py-3 border border-stone-300 text-stone-700 hover:bg-stone-100 transition-colors"
          >
            Skip
          </button>
        </div>

        <p className="text-xs text-stone-500 text-center">
          Your account email: <span className="font-medium text-stone-700">{customerEmail}</span>
        </p>
      </form>
    </div>
  );
}
