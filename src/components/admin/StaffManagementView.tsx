import { useState, useEffect } from 'react';
import { Users, Plus, Mail, Clock, CheckCircle, X, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';
import { adminAuth } from '../../lib/adminAuth';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, type Translations } from '../../lib/bookingLanguage';

type StaffText = {
  inviteSent: string; inviteFailed: string; resent: string; resendFailed: string; confirmCancel: string;
  inviteCancelled: string; cancelFailed: string; statusFailed: string; loading: string; title: string; subtitle: string;
  inviteStaff: string; staffTab: string; invitationsTab: string; noStaff: string; name: string; email: string;
  role: string; lastLogin: string; status: string; actions: string; never: string; active: string; inactive: string;
  deactivate: string; activate: string; noInvitations: string; expired: string; sent: string; expires: string;
  resend: string; cancelInvite: string; inviteTitle: string; close: string; fullName: string; cancel: string;
  sending: string; sendInvite: string;
  roleOwner: string; roleAdmin: string; roleManager: string; roleReceptionist: string; roleCashier: string; roleStaff: string;
};

const TEXT: Translations<StaffText> = {
  en: {
    inviteSent: 'Invitation sent successfully!', inviteFailed: 'Failed to send invitation', resent: 'Invitation resent to {email}',
    resendFailed: 'Failed to resend invitation', confirmCancel: 'Are you sure you want to cancel this invitation?',
    inviteCancelled: 'Invitation cancelled', cancelFailed: 'Failed to cancel invitation', statusFailed: 'Failed to update staff status',
    loading: 'Loading staff...', title: 'Team Management', subtitle: 'Manage your staff members and invitations',
    inviteStaff: 'Invite Staff', staffTab: 'Staff Members ({count})', invitationsTab: 'Invitations ({count})',
    noStaff: 'No staff members yet. Invite your first team member!', name: 'Name', email: 'Email', role: 'Role',
    lastLogin: 'Last Login', status: 'Status', actions: 'Actions', never: 'Never', active: 'Active', inactive: 'Inactive',
    deactivate: 'Deactivate', activate: 'Activate', noInvitations: 'No pending invitations', expired: 'Expired',
    sent: 'Sent {date}', expires: 'Expires {date}', resend: 'Resend invitation', cancelInvite: 'Cancel invitation',
    inviteTitle: 'Invite Team Member', close: 'Close', fullName: 'Full Name', cancel: 'Cancel', sending: 'Sending...',
    sendInvite: 'Send Invitation',
    roleOwner: 'Owner', roleAdmin: 'Admin', roleManager: 'Manager', roleReceptionist: 'Receptionist', roleCashier: 'Cashier', roleStaff: 'Staff',
  },
  de: {
    inviteSent: 'Einladung wurde gesendet.', inviteFailed: 'Einladung konnte nicht gesendet werden', resent: 'Einladung erneut an {email} gesendet',
    resendFailed: 'Einladung konnte nicht erneut gesendet werden', confirmCancel: 'Diese Einladung wirklich zurückziehen?',
    inviteCancelled: 'Einladung zurückgezogen', cancelFailed: 'Einladung konnte nicht zurückgezogen werden', statusFailed: 'Status konnte nicht geändert werden',
    loading: 'Team wird geladen…', title: 'Teamverwaltung', subtitle: 'Mitarbeiter:innen und Einladungen verwalten',
    inviteStaff: 'Mitarbeiter:in einladen', staffTab: 'Mitarbeiter:innen ({count})', invitationsTab: 'Einladungen ({count})',
    noStaff: 'Noch keine Mitarbeiter:innen. Laden Sie die erste Person ins Team ein.', name: 'Name', email: 'E-Mail', role: 'Rolle',
    lastLogin: 'Letzte Anmeldung', status: 'Status', actions: 'Aktionen', never: 'Nie', active: 'Aktiv', inactive: 'Inaktiv',
    deactivate: 'Deaktivieren', activate: 'Aktivieren', noInvitations: 'Keine offenen Einladungen', expired: 'Abgelaufen',
    sent: 'Gesendet am {date}', expires: 'Läuft ab am {date}', resend: 'Einladung erneut senden', cancelInvite: 'Einladung zurückziehen',
    inviteTitle: 'Teammitglied einladen', close: 'Schließen', fullName: 'Vollständiger Name', cancel: 'Abbrechen', sending: 'Wird gesendet…',
    sendInvite: 'Einladung senden',
    roleOwner: 'Inhaber:in', roleAdmin: 'Admin', roleManager: 'Manager:in', roleReceptionist: 'Empfang', roleCashier: 'Kasse', roleStaff: 'Mitarbeiter:in',
  },
  th: {
    inviteSent: 'ส่งคำเชิญเรียบร้อยแล้ว', inviteFailed: 'ส่งคำเชิญไม่สำเร็จ', resent: 'ส่งคำเชิญอีกครั้งถึง {email} แล้ว',
    resendFailed: 'ส่งคำเชิญอีกครั้งไม่สำเร็จ', confirmCancel: 'ต้องการยกเลิกคำเชิญนี้ใช่หรือไม่?',
    inviteCancelled: 'ยกเลิกคำเชิญแล้ว', cancelFailed: 'ยกเลิกคำเชิญไม่สำเร็จ', statusFailed: 'เปลี่ยนสถานะพนักงานไม่สำเร็จ',
    loading: 'กำลังโหลดพนักงาน…', title: 'จัดการทีม', subtitle: 'จัดการพนักงานและคำเชิญ',
    inviteStaff: 'เชิญพนักงาน', staffTab: 'พนักงาน ({count})', invitationsTab: 'คำเชิญ ({count})',
    noStaff: 'ยังไม่มีพนักงาน เชิญสมาชิกคนแรกเข้าทีมได้เลย', name: 'ชื่อ', email: 'อีเมล', role: 'บทบาท',
    lastLogin: 'เข้าสู่ระบบล่าสุด', status: 'สถานะ', actions: 'การดำเนินการ', never: 'ไม่เคย', active: 'ใช้งาน', inactive: 'ไม่ใช้งาน',
    deactivate: 'ปิดการใช้งาน', activate: 'เปิดการใช้งาน', noInvitations: 'ไม่มีคำเชิญที่รอตอบรับ', expired: 'หมดอายุ',
    sent: 'ส่งเมื่อ {date}', expires: 'หมดอายุ {date}', resend: 'ส่งคำเชิญอีกครั้ง', cancelInvite: 'ยกเลิกคำเชิญ',
    inviteTitle: 'เชิญสมาชิกทีม', close: 'ปิด', fullName: 'ชื่อ-นามสกุล', cancel: 'ยกเลิก', sending: 'กำลังส่ง…',
    sendInvite: 'ส่งคำเชิญ',
    roleOwner: 'เจ้าของร้าน', roleAdmin: 'ผู้ดูแล', roleManager: 'ผู้จัดการ', roleReceptionist: 'พนักงานต้อนรับ', roleCashier: 'แคชเชียร์', roleStaff: 'พนักงาน',
  },
};

const ROLE_LABEL_KEY: Record<string, keyof StaffText> = {
  owner: 'roleOwner',
  admin: 'roleAdmin',
  manager: 'roleManager',
  receptionist: 'roleReceptionist',
  cashier: 'roleCashier',
  staff: 'roleStaff',
};

interface StaffMember {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  last_login: string | null;
  invited_by: string | null;
  accepted_invite_at: string | null;
}

interface Invitation {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  expires_at: string;
  is_used: boolean;
  invite_token: string;
}

export default function StaffManagementView() {
  const { t, locale } = useAdminText(TEXT);
  const roleLabel = (role: string) => (ROLE_LABEL_KEY[role] ? t[ROLE_LABEL_KEY[role]] : role);
  const { businessId } = useTenant();
  const currentUser = adminAuth.getCurrentUser();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'staff' | 'invitations'>('staff');
  const [inviteForm, setInviteForm] = useState({
    email: '',
    full_name: '',
    role: 'staff',
  });
  const [inviteError, setInviteError] = useState('');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [businessId]);

  const fetchData = async () => {
    if (!businessId) return;

    setLoading(true);

    const [staffResult, invitationsResult] = await Promise.all([
      supabase
        .from('admin_users')
        .select('id, email, full_name, role, is_active, last_login, invited_by, accepted_invite_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false }),
      supabase
        .from('staff_invitations')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false }),
    ]);

    if (staffResult.data) {
      setStaff(staffResult.data);
    }

    if (invitationsResult.data) {
      setInvitations(invitationsResult.data);
    }

    setLoading(false);
  };

  const handleInviteStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviting(true);

    try {
      if (!currentUser?.id) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.rpc('create_staff_invitation', {
        p_business_id: businessId,
        p_email: inviteForm.email,
        p_full_name: inviteForm.full_name,
        p_role: inviteForm.role,
        p_created_by: currentUser.id,
      });

      if (error) throw error;

      const inviteToken = await getInviteToken(data);

      if (inviteToken) {
        await sendInvitationEmail(inviteForm.email, inviteForm.full_name, inviteToken);
      }

      setShowInviteModal(false);
      setInviteForm({ email: '', full_name: '', role: 'staff' });
      await fetchData();

      alert(t.inviteSent);
    } catch (err: any) {
      console.error('Error sending invitation:', err);
      setInviteError(err.message || t.inviteFailed);
    } finally {
      setInviting(false);
    }
  };

  const getInviteToken = async (inviteId: string): Promise<string | null> => {
    const { data } = await supabase
      .from('staff_invitations')
      .select('invite_token')
      .eq('id', inviteId)
      .single();

    return data?.invite_token || null;
  };

  const sendInvitationEmail = async (email: string, fullName: string, token: string) => {
    const inviteUrl = `${window.location.origin}/accept-invite?token=${token}`;

    const { data: business } = await supabase
      .from('businesses')
      .select('name')
      .eq('id', businessId)
      .maybeSingle();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    try {
      const { error } = await supabase.functions.invoke('send-platform-email', {
        body: {
          event_key: 'staff_invitation',
          recipient_email: email,
          variables: {
            business_name: business?.name || 'Your Business',
            staff_name: fullName,
            staff_email: email,
            role: inviteForm.role,
            invite_url: inviteUrl,
            invite_expires_at: expiresAt.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }),
          },
          business_id: businessId,
        },
      });

      if (error) {
        console.error('Failed to send invitation email:', error);
        throw error;
      }

      console.log('✅ Invitation email sent successfully to:', email);
    } catch (error) {
      console.error('Error sending invitation email:', error);
      throw error;
    }
  };

  const handleResendInvitation = async (invitation: Invitation) => {
    try {
      await sendInvitationEmail(invitation.email, invitation.full_name, invitation.invite_token);
      alert(fillText(t.resent, { email: invitation.email }));
    } catch (err) {
      console.error('Error resending invitation:', err);
      alert(t.resendFailed);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm(t.confirmCancel)) return;

    try {
      const { error } = await supabase
        .from('staff_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      await fetchData();
      alert(t.inviteCancelled);
    } catch (err) {
      console.error('Error cancelling invitation:', err);
      alert(t.cancelFailed);
    }
  };

  const handleToggleStaffStatus = async (staffId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('admin_users')
        .update({ is_active: !currentStatus })
        .eq('id', staffId);

      if (error) throw error;

      await fetchData();
    } catch (err) {
      console.error('Error updating staff status:', err);
      alert(t.statusFailed);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800';
      case 'admin':
      case 'manager':
        return 'bg-blue-100 text-blue-800';
      case 'receptionist':
        return 'bg-green-100 text-green-800';
      case 'cashier':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-stone-600">{t.loading}</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 mb-2">{t.title}</h1>
          <p className="text-stone-600">{t.subtitle}</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-stone-900 text-white hover:bg-stone-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {t.inviteStaff}
        </button>
      </div>

      <div className="bg-white shadow">
        <div className="border-b border-stone-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('staff')}
              className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                activeTab === 'staff'
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {fillText(t.staffTab, { count: staff.length })}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('invitations')}
              className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                activeTab === 'invitations'
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                {fillText(t.invitationsTab, { count: invitations.filter(inv => !inv.is_used).length })}
              </div>
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'staff' && (
            <div className="space-y-4">
              {staff.length === 0 ? (
                <div className="text-center py-12 text-stone-500">
                  <Users className="w-16 h-16 mx-auto mb-4 text-stone-300" />
                  <p>{t.noStaff}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-stone-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-stone-700">{t.name}</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-stone-700">{t.email}</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-stone-700">{t.role}</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-stone-700">{t.lastLogin}</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-stone-700">{t.status}</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-stone-700">{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.map((member) => (
                        <tr key={member.id} className="border-b border-stone-100 hover:bg-stone-50">
                          <td className="py-4 px-4">
                            <div className="font-medium text-stone-900">{member.full_name}</div>
                          </td>
                          <td className="py-4 px-4 text-stone-600">{member.email}</td>
                          <td className="py-4 px-4">
                            <span className={`px-3 py-1 text-xs font-semibold uppercase ${getRoleBadgeColor(member.role)}`}>
                              {roleLabel(member.role)}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-sm text-stone-600">
                            {member.last_login ? formatDate(member.last_login) : t.never}
                          </td>
                          <td className="py-4 px-4">
                            <span
                              className={`px-3 py-1 text-xs font-semibold ${
                                member.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {member.is_active ? t.active : t.inactive}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            {member.id !== currentUser?.id && (
                              <button
                                onClick={() => handleToggleStaffStatus(member.id, member.is_active)}
                                className="text-sm text-stone-600 hover:text-stone-900"
                              >
                                {member.is_active ? t.deactivate : t.activate}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'invitations' && (
            <div className="space-y-4">
              {invitations.filter(inv => !inv.is_used).length === 0 ? (
                <div className="text-center py-12 text-stone-500">
                  <Mail className="w-16 h-16 mx-auto mb-4 text-stone-300" />
                  <p>{t.noInvitations}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {invitations
                    .filter(inv => !inv.is_used)
                    .map((invitation) => (
                      <div
                        key={invitation.id}
                        className="border border-stone-200 p-4 flex items-center justify-between hover:bg-stone-50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-stone-900">{invitation.full_name}</h3>
                            <span className={`px-3 py-1 text-xs font-semibold uppercase ${getRoleBadgeColor(invitation.role)}`}>
                              {roleLabel(invitation.role)}
                            </span>
                            {isExpired(invitation.expires_at) && (
                              <span className="px-3 py-1 text-xs font-semibold bg-red-100 text-red-800">
                                {t.expired}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-stone-600 mb-1">{invitation.email}</p>
                          <div className="flex items-center gap-4 text-xs text-stone-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {fillText(t.sent, { date: formatDate(invitation.created_at) })}
                            </span>
                            <span>{fillText(t.expires, { date: formatDate(invitation.expires_at) })}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleResendInvitation(invitation)}
                            className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                            title={t.resend}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleCancelInvitation(invitation.id)}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50"
                            title={t.cancelInvite}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 max-w-md w-full shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-stone-900">{t.inviteTitle}</h2>
              <button onClick={() => setShowInviteModal(false)} aria-label={t.close} className="text-stone-500 hover:text-stone-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            {inviteError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
                {inviteError}
              </div>
            )}

            <form onSubmit={handleInviteStaff} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">{t.fullName}</label>
                <input
                  type="text"
                  value={inviteForm.full_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-stone-300 focus:ring-2 focus:ring-stone-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">{t.email}</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full px-4 py-2 border border-stone-300 focus:ring-2 focus:ring-stone-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">{t.role}</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className="w-full px-4 py-2 border border-stone-300 focus:ring-2 focus:ring-stone-500 focus:border-transparent"
                >
                  <option value="staff">{t.roleStaff}</option>
                  <option value="receptionist">{t.roleReceptionist}</option>
                  <option value="cashier">{t.roleCashier}</option>
                  <option value="manager">{t.roleManager}</option>
                  <option value="admin">{t.roleAdmin}</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-3 border border-stone-300 text-stone-700 hover:bg-stone-50"
                  disabled={inviting}
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-50"
                  disabled={inviting}
                >
                  {inviting ? t.sending : t.sendInvite}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
