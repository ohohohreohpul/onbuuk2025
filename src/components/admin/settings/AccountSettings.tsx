import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Save, AlertCircle, CheckCircle, Mail, Lock, Eye, EyeOff, User } from 'lucide-react';

interface UserInfo {
  email: string;
  id: string;
}

export default function AccountSettings() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Email change state
  const [newEmail, setNewEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const { data: { user: authUser }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error('Error fetching user:', error);
        return;
      }
      
      if (authUser) {
        setUser({
          email: authUser.email || '',
          id: authUser.id,
        });
        setNewEmail(authUser.email || '');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEmail || newEmail === user?.email) {
      setEmailMessage({ type: 'error', text: 'Please enter a new email address' });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setEmailMessage({ type: 'error', text: 'Please enter a valid email address' });
      return;
    }

    setEmailSaving(true);
    setEmailMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });

      if (error) {
        throw error;
      }

      setEmailMessage({ 
        type: 'success', 
        text: 'A confirmation email has been sent to your new email address. Please check your inbox and click the confirmation link to complete the change.' 
      });
    } catch (error: any) {
      console.error('Error updating email:', error);
      setEmailMessage({ 
        type: 'error', 
        text: error.message || 'Failed to update email. Please try again.' 
      });
    } finally {
      setEmailSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!newPassword) {
      setPasswordMessage({ type: 'error', text: 'Please enter a new password' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    setPasswordSaving(true);
    setPasswordMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        throw error;
      }

      setPasswordMessage({ 
        type: 'success', 
        text: 'Password updated successfully!' 
      });
      
      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error updating password:', error);
      setPasswordMessage({ 
        type: 'error', 
        text: error.message || 'Failed to update password. Please try again.' 
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return <div className="text-stone-600">Loading...</div>;
  }

  if (!user) {
    return <div className="text-stone-600">Unable to load user information</div>;
  }

  return (
    <div className="space-y-8">
      {/* Current Account Info */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-stone-200 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-stone-600" />
          </div>
          <div>
            <p className="text-sm text-stone-500">Logged in as</p>
            <p className="font-medium text-stone-800">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Change Email Section */}
      <div>
        <h3 className="text-lg font-medium text-stone-800 mb-4 flex items-center space-x-2">
          <Mail className="w-5 h-5" />
          <span>Change Email Address</span>
        </h3>

        <form onSubmit={handleEmailChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Current Email
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full px-4 py-2 border border-stone-200 rounded bg-stone-100 text-stone-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              New Email Address
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Enter new email address"
              className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
            />
          </div>

          {emailMessage && (
            <div className={`p-4 rounded flex items-start space-x-2 ${
              emailMessage.type === 'success' 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              {emailMessage.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <span className={emailMessage.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                {emailMessage.text}
              </span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={emailSaving || newEmail === user.email}
              className="flex items-center space-x-2 px-6 py-2.5 bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded"
            >
              <Save className="w-4 h-4" />
              <span>{emailSaving ? 'Updating...' : 'Update Email'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Divider */}
      <div className="border-t border-stone-200"></div>

      {/* Change Password Section */}
      <div>
        <h3 className="text-lg font-medium text-stone-800 mb-4 flex items-center space-x-2">
          <Lock className="w-5 h-5" />
          <span>Change Password</span>
        </h3>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full px-4 py-2 pr-12 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-stone-500 mt-1">Minimum 6 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-4 py-2 pr-12 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {passwordMessage && (
            <div className={`p-4 rounded flex items-start space-x-2 ${
              passwordMessage.type === 'success' 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              {passwordMessage.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <span className={passwordMessage.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                {passwordMessage.text}
              </span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={passwordSaving || !newPassword || !confirmPassword}
              className="flex items-center space-x-2 px-6 py-2.5 bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded"
            >
              <Save className="w-4 h-4" />
              <span>{passwordSaving ? 'Updating...' : 'Update Password'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Security Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Security Tips</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Use a strong, unique password that you don't use elsewhere</li>
              <li>Include a mix of letters, numbers, and special characters</li>
              <li>Email changes require confirmation via the new email address</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
