import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Save, AlertCircle, CheckCircle, Mail, Lock, Eye, EyeOff, User } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import type { Translations } from '../../../lib/bookingLanguage';

const TEXT: Translations<{
  enterNewEmail: string; invalidEmail: string; emailConfirmSent: string; emailFailed: string; enterNewPassword: string;
  passwordTooShort: string; passwordMismatch: string; passwordUpdated: string; passwordFailed: string; loading: string;
  loadFailed: string; loggedInAs: string; changeEmail: string; currentEmail: string; newEmail: string;
  newEmailPlaceholder: string; updating: string; updateEmail: string; changePassword: string; newPassword: string;
  newPasswordPlaceholder: string; minChars: string; confirmPassword: string; confirmPasswordPlaceholder: string;
  showPassword: string; hidePassword: string; updatePassword: string; securityTips: string; tipUnique: string;
  tipMix: string; tipEmail: string;
}> = {
  en: {
    enterNewEmail: 'Please enter a new email address', invalidEmail: 'Please enter a valid email address',
    emailConfirmSent: 'A confirmation email has been sent to your new email address. Please check your inbox and click the confirmation link to complete the change.',
    emailFailed: 'Failed to update email. Please try again.', enterNewPassword: 'Please enter a new password',
    passwordTooShort: 'Password must be at least 6 characters long', passwordMismatch: 'Passwords do not match',
    passwordUpdated: 'Password updated successfully!', passwordFailed: 'Failed to update password. Please try again.',
    loading: 'Loading...', loadFailed: 'Unable to load user information', loggedInAs: 'Logged in as',
    changeEmail: 'Change Email Address', currentEmail: 'Current Email', newEmail: 'New Email Address',
    newEmailPlaceholder: 'Enter new email address', updating: 'Updating...', updateEmail: 'Update Email',
    changePassword: 'Change Password', newPassword: 'New Password', newPasswordPlaceholder: 'Enter new password',
    minChars: 'Minimum 6 characters', confirmPassword: 'Confirm New Password', confirmPasswordPlaceholder: 'Confirm new password',
    showPassword: 'Show password', hidePassword: 'Hide password', updatePassword: 'Update Password', securityTips: 'Security Tips',
    tipUnique: "Use a strong, unique password that you don't use elsewhere",
    tipMix: 'Include a mix of letters, numbers, and special characters',
    tipEmail: 'Email changes require confirmation via the new email address',
  },
  de: {
    enterNewEmail: 'Bitte eine neue E-Mail-Adresse eingeben', invalidEmail: 'Bitte eine gültige E-Mail-Adresse eingeben',
    emailConfirmSent: 'Eine Bestätigungs-E-Mail wurde an die neue Adresse gesendet. Bitte den Bestätigungslink in der E-Mail anklicken, um die Änderung abzuschließen.',
    emailFailed: 'E-Mail-Adresse konnte nicht geändert werden. Bitte erneut versuchen.', enterNewPassword: 'Bitte ein neues Passwort eingeben',
    passwordTooShort: 'Das Passwort muss mindestens 6 Zeichen lang sein', passwordMismatch: 'Die Passwörter stimmen nicht überein',
    passwordUpdated: 'Passwort geändert.', passwordFailed: 'Passwort konnte nicht geändert werden. Bitte erneut versuchen.',
    loading: 'Wird geladen…', loadFailed: 'Benutzerdaten konnten nicht geladen werden', loggedInAs: 'Angemeldet als',
    changeEmail: 'E-Mail-Adresse ändern', currentEmail: 'Aktuelle E-Mail-Adresse', newEmail: 'Neue E-Mail-Adresse',
    newEmailPlaceholder: 'Neue E-Mail-Adresse eingeben', updating: 'Wird aktualisiert…', updateEmail: 'E-Mail-Adresse ändern',
    changePassword: 'Passwort ändern', newPassword: 'Neues Passwort', newPasswordPlaceholder: 'Neues Passwort eingeben',
    minChars: 'Mindestens 6 Zeichen', confirmPassword: 'Neues Passwort bestätigen', confirmPasswordPlaceholder: 'Neues Passwort wiederholen',
    showPassword: 'Passwort anzeigen', hidePassword: 'Passwort verbergen', updatePassword: 'Passwort ändern', securityTips: 'Sicherheitstipps',
    tipUnique: 'Ein starkes, einmaliges Passwort verwenden, das nirgendwo sonst genutzt wird',
    tipMix: 'Buchstaben, Zahlen und Sonderzeichen kombinieren',
    tipEmail: 'Eine neue E-Mail-Adresse muss über diese Adresse bestätigt werden',
  },
  th: {
    enterNewEmail: 'กรุณาใส่อีเมลใหม่', invalidEmail: 'กรุณาใส่อีเมลที่ถูกต้อง',
    emailConfirmSent: 'ส่งอีเมลยืนยันไปยังอีเมลใหม่แล้ว กรุณาเปิดกล่องจดหมายและคลิกลิงก์ยืนยันเพื่อเปลี่ยนให้เสร็จสมบูรณ์',
    emailFailed: 'เปลี่ยนอีเมลไม่สำเร็จ กรุณาลองอีกครั้ง', enterNewPassword: 'กรุณาใส่รหัสผ่านใหม่',
    passwordTooShort: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', passwordMismatch: 'รหัสผ่านไม่ตรงกัน',
    passwordUpdated: 'เปลี่ยนรหัสผ่านแล้ว', passwordFailed: 'เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองอีกครั้ง',
    loading: 'กำลังโหลด…', loadFailed: 'โหลดข้อมูลผู้ใช้ไม่สำเร็จ', loggedInAs: 'เข้าสู่ระบบในชื่อ',
    changeEmail: 'เปลี่ยนอีเมล', currentEmail: 'อีเมลปัจจุบัน', newEmail: 'อีเมลใหม่',
    newEmailPlaceholder: 'ใส่อีเมลใหม่', updating: 'กำลังอัปเดต…', updateEmail: 'เปลี่ยนอีเมล',
    changePassword: 'เปลี่ยนรหัสผ่าน', newPassword: 'รหัสผ่านใหม่', newPasswordPlaceholder: 'ใส่รหัสผ่านใหม่',
    minChars: 'อย่างน้อย 6 ตัวอักษร', confirmPassword: 'ยืนยันรหัสผ่านใหม่', confirmPasswordPlaceholder: 'ใส่รหัสผ่านใหม่อีกครั้ง',
    showPassword: 'แสดงรหัสผ่าน', hidePassword: 'ซ่อนรหัสผ่าน', updatePassword: 'เปลี่ยนรหัสผ่าน', securityTips: 'คำแนะนำด้านความปลอดภัย',
    tipUnique: 'ใช้รหัสผ่านที่คาดเดายากและไม่ซ้ำกับที่อื่น',
    tipMix: 'ผสมตัวอักษร ตัวเลข และอักขระพิเศษ',
    tipEmail: 'การเปลี่ยนอีเมลต้องยืนยันผ่านอีเมลใหม่',
  },
};

interface UserInfo {
  email: string;
  id: string;
}

export default function AccountSettings() {
  const { t } = useAdminText(TEXT);
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
      setEmailMessage({ type: 'error', text: t.enterNewEmail });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setEmailMessage({ type: 'error', text: t.invalidEmail });
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
        text: t.emailConfirmSent 
      });
    } catch (error: any) {
      console.error('Error updating email:', error);
      setEmailMessage({ 
        type: 'error', 
        text: error.message || t.emailFailed 
      });
    } finally {
      setEmailSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!newPassword) {
      setPasswordMessage({ type: 'error', text: t.enterNewPassword });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: t.passwordTooShort });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: t.passwordMismatch });
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
        text: t.passwordUpdated 
      });
      
      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error updating password:', error);
      setPasswordMessage({ 
        type: 'error', 
        text: error.message || t.passwordFailed 
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return <div className="text-stone-600">{t.loading}</div>;
  }

  if (!user) {
    return <div className="text-stone-600">{t.loadFailed}</div>;
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
            <p className="text-sm text-stone-500">{t.loggedInAs}</p>
            <p className="font-medium text-stone-800">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Change Email Section */}
      <div>
        <h3 className="text-lg font-medium text-stone-800 mb-4 flex items-center space-x-2">
          <Mail className="w-5 h-5" />
          <span>{t.changeEmail}</span>
        </h3>

        <form onSubmit={handleEmailChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              {t.currentEmail}
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
              {t.newEmail}
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={t.newEmailPlaceholder}
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
              <span>{emailSaving ? t.updating : t.updateEmail}</span>
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
          <span>{t.changePassword}</span>
        </h3>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              {t.newPassword}
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t.newPasswordPlaceholder}
                className="w-full px-4 py-2 pr-12 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                aria-label={showNewPassword ? t.hidePassword : t.showPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-stone-500 mt-1">{t.minChars}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              {t.confirmPassword}
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t.confirmPasswordPlaceholder}
                className="w-full px-4 py-2 pr-12 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? t.hidePassword : t.showPassword}
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
              <span>{passwordSaving ? t.updating : t.updatePassword}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Security Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">{t.securityTips}</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>{t.tipUnique}</li>
              <li>{t.tipMix}</li>
              <li>{t.tipEmail}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
