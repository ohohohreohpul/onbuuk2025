import { useState, useEffect } from 'react';
import { Users, Plus, Mail, Clock, X, Trash2, RefreshCw, Shield, LockKeyhole } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';
import { adminAuth } from '../../lib/adminAuth';
import { usePermissions } from '../../hooks/usePermissions';
import {
  ADMIN_INPUT,
  ADMIN_MODAL,
  ADMIN_MODAL_BACKDROP,
  ADMIN_PRIMARY_BUTTON,
  ADMIN_SECONDARY_BUTTON,
  ADMIN_SEGMENT_ACTIVE,
  ADMIN_SEGMENT_INACTIVE,
  ADMIN_SEGMENTED_CONTROL,
  ADMIN_SELECT,
  ADMIN_STATUS_PILL,
  ADMIN_SURFACE,
  ADMIN_TERTIARY_BUTTON,
} from './adminUi';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText } from '../../lib/bookingLanguage';
import { categoryLabel, permissionLabel, roleLabel } from './roleLabels';
import { PRIMARY_ROLE_KEY, TEXT, type FeedbackKey } from './teamManagementText';

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

interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string;
  is_system_role: boolean;
}

interface Permission {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
}

interface AdminUserWithRoles {
  id: string;
  email: string;
  full_name: string;
  role: string;
  roles: Role[];
}

export default function TeamManagementView() {
  const { t, lang, locale } = useAdminText(TEXT);
  const primaryRoleLabel = (role: string) => (PRIMARY_ROLE_KEY[role] ? t[PRIMARY_ROLE_KEY[role]] : role.replace('_', ' '));
  const { businessId } = useTenant();
  const currentUser = adminAuth.getCurrentUser();
  const { hasPermission } = usePermissions(currentUser?.id || null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<AdminUserWithRoles[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'team' | 'invitations' | 'roles'>('team');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    full_name: '',
    role: 'staff',
  });
  const [inviteError, setInviteError] = useState('');
  const [inviting, setInviting] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; key: FeedbackKey; email?: string } | null>(null);

  const canAssignRoles = hasPermission('assign_roles');

  useEffect(() => {
    fetchData();
  }, [businessId]);

  const fetchData = async () => {
    if (!businessId) return;

    setLoading(true);

    const [staffResult, invitationsResult, rolesRes, permsRes, usersRes] = await Promise.all([
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
      supabase
        .from('roles')
        .select('*')
        .eq('business_id', businessId)
        .order('name'),
      supabase
        .from('permissions')
        .select('*')
        .order('category, name'),
      supabase
        .from('admin_users')
        .select('id, email, full_name, role')
        .eq('business_id', businessId)
        .eq('is_active', true)
    ]);

    if (staffResult.data) setStaff(staffResult.data);
    if (invitationsResult.data) setInvitations(invitationsResult.data);
    if (rolesRes.data) setRoles(rolesRes.data);
    if (permsRes.data) setPermissions(permsRes.data);

    if (usersRes.data) {
      const usersWithRoles = await Promise.all(
        usersRes.data.map(async (user) => {
          const { data: userRoles } = await supabase
            .from('admin_user_roles')
            .select('roles!inner(*)')
            .eq('admin_user_id', user.id);

          return {
            ...user,
            roles: userRoles?.map(ur => ur.roles as unknown as Role) || []
          };
        })
      );
      setUsers(usersWithRoles);
    }

    setLoading(false);
  };

  const loadRolePermissions = async (roleId: string) => {
    const { data } = await supabase
      .from('role_permissions')
      .select('permission_id')
      .eq('role_id', roleId);

    if (data) {
      setRolePermissions(data.map(rp => rp.permission_id));
    }
  };

  const handleRoleSelect = async (roleId: string) => {
    setSelectedRole(roleId);
    await loadRolePermissions(roleId);
  };

  const togglePermission = async (permissionId: string) => {
    if (!selectedRole || !canAssignRoles) return;

    const role = roles.find(r => r.id === selectedRole);
    if (role?.is_system_role) {
      setFeedback({ tone: 'error', key: 'systemLocked' });
      return;
    }

    const hasPermission = rolePermissions.includes(permissionId);

    if (hasPermission) {
      await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', selectedRole)
        .eq('permission_id', permissionId);

      setRolePermissions(prev => prev.filter(id => id !== permissionId));
    } else {
      await supabase
        .from('role_permissions')
        .insert({ role_id: selectedRole, permission_id: permissionId });

      setRolePermissions(prev => [...prev, permissionId]);
    }
  };

  const assignRoleToUser = async (userId: string, roleId: string) => {
    if (!canAssignRoles) return;

    try {
      await supabase
        .from('admin_user_roles')
        .insert({ admin_user_id: userId, role_id: roleId });

      await fetchData();
    } catch (error) {
      console.error('Error assigning role:', error);
    }
  };

  const removeRoleFromUser = async (userId: string, roleId: string) => {
    if (!canAssignRoles) return;

    try {
      await supabase
        .from('admin_user_roles')
        .delete()
        .eq('admin_user_id', userId)
        .eq('role_id', roleId);

      await fetchData();
    } catch (error) {
      console.error('Error removing role:', error);
    }
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

      setFeedback({ tone: 'success', key: 'inviteSent', email: inviteForm.email });
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
      setFeedback({ tone: 'success', key: 'resent', email: invitation.email });
    } catch (err) {
      console.error('Error resending invitation:', err);
      setFeedback({ tone: 'error', key: 'resendFailed' });
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
      setFeedback({ tone: 'success', key: 'inviteCancelled' });
    } catch (err) {
      console.error('Error cancelling invitation:', err);
      setFeedback({ tone: 'error', key: 'cancelFailed' });
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
      setFeedback({ tone: 'success', key: currentStatus ? 'deactivated' : 'activated' });
    } catch (err) {
      console.error('Error updating staff status:', err);
      setFeedback({ tone: 'error', key: 'statusFailed' });
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-[#F0EDE8] text-stone-700';
      case 'admin':
      case 'manager':
        return 'bg-emerald-50 text-emerald-700';
      case 'receptionist':
        return 'bg-amber-50 text-amber-700';
      case 'cashier':
        return 'bg-orange-100 text-orange-800';
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

  const permissionsByCategory = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const selectedRoleRecord = roles.find(role => role.id === selectedRole);

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-52 rounded-lg bg-stone-900/[0.06]" />
            <div className="h-4 w-80 rounded bg-stone-900/[0.04]" />
          </div>
          <div className="h-11 w-44 rounded-xl bg-stone-900/[0.06]" />
        </div>
        <div className={`${ADMIN_SURFACE} h-64 bg-stone-900/[0.025]`} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight text-[#1A1714]">{t.title}</h1>
          <p className="text-sm text-stone-500">{t.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowInviteModal(true)}
          className={ADMIN_PRIMARY_BUTTON}
        >
          <Plus className="h-4 w-4" />
          {t.inviteMember}
        </button>
      </div>

      {feedback && (
        <div
          role="status"
          className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-sm ${
            feedback.tone === 'success'
              ? 'border-emerald-200/80 bg-emerald-50/70 text-emerald-800'
              : 'border-red-200/80 bg-red-50/70 text-red-800'
          }`}
        >
          <span>{fillText(t[feedback.key], { email: feedback.email ?? '' })}</span>
          <button type="button" onClick={() => setFeedback(null)} className="rounded-lg p-1 transition hover:bg-black/5" aria-label={t.dismiss}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="overflow-x-auto pb-1">
        <div className={`${ADMIN_SEGMENTED_CONTROL} min-w-max`}>
          {[
            { id: 'team' as const, label: t.tabTeam, count: staff.length, icon: Users },
            { id: 'invitations' as const, label: t.tabInvitations, count: invitations.filter(inv => !inv.is_used).length, icon: Mail },
            { id: 'roles' as const, label: t.tabRoles, count: roles.length, icon: Shield },
          ].map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id ? ADMIN_SEGMENT_ACTIVE : ADMIN_SEGMENT_INACTIVE
              }`}
            >
              <tab.icon className="h-4 w-4" strokeWidth={1.75} />
              {tab.label}
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${activeTab === tab.id ? 'bg-white/15' : 'bg-stone-900/[0.05]'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'team' && (
        <div className={`${ADMIN_SURFACE} overflow-hidden`}>
          {staff.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-900/[0.05]">
                <Users className="h-5 w-5 text-stone-500" strokeWidth={1.75} />
              </div>
              <h3 className="font-semibold text-[#1A1714]">{t.emptyTeamTitle}</h3>
              <p className="mt-1 max-w-sm text-sm text-stone-500">{t.emptyTeamBody}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px]">
                <thead className="border-b border-stone-200/70 bg-stone-900/[0.025]">
                  <tr>
                    {[t.colMember, t.colPrimaryRole, t.colAdditionalRoles, t.colLastLogin, t.colStatus, ''].map((heading, headingIndex) => (
                      <th key={headingIndex} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400 last:text-right">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200/60">
                  {staff.map((member) => {
                    const userWithRoles = users.find(user => user.id === member.id);
                    const initials = (member.full_name || member.email)
                      .split(/\s+/)
                      .map(part => part[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <tr key={member.id} className="transition-colors hover:bg-white/60">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1A1714] text-xs font-semibold text-white">
                              {initials}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[#1A1714]">{member.full_name}</p>
                              <p className="mt-0.5 text-xs text-stone-400">{member.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`${ADMIN_STATUS_PILL} ${getRoleBadgeColor(member.role)}`}>
                            {primaryRoleLabel(member.role)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex max-w-xs flex-wrap items-center gap-1.5">
                            {userWithRoles?.roles.map(role => (
                              <span key={role.id} className={`${ADMIN_STATUS_PILL} bg-stone-900/[0.05] text-stone-600`}>
                                {roleLabel(role, lang)[0]}
                                {canAssignRoles && member.id !== currentUser?.id && (
                                  <button type="button" onClick={() => removeRoleFromUser(member.id, role.id)} className="rounded-full p-0.5 hover:bg-stone-900/10" aria-label={fillText(t.removeRole, { role: roleLabel(role, lang)[0] })}>
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </span>
                            ))}
                            {canAssignRoles && member.id !== currentUser?.id && (
                              <select
                                onChange={(event) => {
                                  if (event.target.value) {
                                    void assignRoleToUser(member.id, event.target.value);
                                    event.target.value = '';
                                  }
                                }}
                                className="rounded-lg border border-stone-200/80 bg-white/70 px-2 py-1 text-xs text-stone-600 outline-none focus:border-stone-400"
                                defaultValue=""
                              >
                                <option value="" disabled>{t.addRole}</option>
                                {roles
                                  .filter(role => !userWithRoles?.roles.some(userRole => userRole.id === role.id))
                                  .map(role => <option key={role.id} value={role.id}>{roleLabel(role, lang)[0]}</option>)}
                              </select>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-stone-500">
                          {member.last_login ? formatDate(member.last_login) : t.never}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`${ADMIN_STATUS_PILL} ${member.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${member.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            {member.is_active ? t.active : t.inactive}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {member.id !== currentUser?.id && (
                            <button type="button" onClick={() => handleToggleStaffStatus(member.id, member.is_active)} className={ADMIN_TERTIARY_BUTTON}>
                              {member.is_active ? t.deactivate : t.activate}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'invitations' && (
        <div className={`${ADMIN_SURFACE} p-5`}>
          {invitations.filter(invitation => !invitation.is_used).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-900/[0.05]">
                <Mail className="h-5 w-5 text-stone-500" strokeWidth={1.75} />
              </div>
              <h3 className="font-semibold text-[#1A1714]">{t.noInvitations}</h3>
              <p className="mt-1 text-sm text-stone-500">{t.noInvitationsBody}</p>
            </div>
          ) : (
            <div className="divide-y divide-stone-200/60">
              {invitations.filter(invitation => !invitation.is_used).map((invitation) => (
                <div key={invitation.id} className="flex flex-col justify-between gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-[#1A1714]">{invitation.full_name}</h3>
                      <span className={`${ADMIN_STATUS_PILL} ${getRoleBadgeColor(invitation.role)}`}>{primaryRoleLabel(invitation.role)}</span>
                      {isExpired(invitation.expires_at) && (
                        <span className={`${ADMIN_STATUS_PILL} bg-red-50 text-red-700`}>{t.expired}</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-stone-500">{invitation.email}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-stone-400">
                      <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {fillText(t.sent, { date: formatDate(invitation.created_at) })}</span>
                      <span>{fillText(t.expires, { date: formatDate(invitation.expires_at) })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => handleResendInvitation(invitation)} className={ADMIN_SECONDARY_BUTTON}>
                      <RefreshCw className="h-4 w-4" /> {t.resend}
                    </button>
                    <button type="button" onClick={() => handleCancelInvitation(invitation.id)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-red-600 transition hover:bg-red-50" aria-label={t.cancelInvite}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'roles' && (
        !canAssignRoles ? (
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 text-sm text-amber-800">
            {t.noRolePermission}
          </div>
        ) : (
          <div className={`${ADMIN_SURFACE} grid overflow-hidden lg:grid-cols-[300px_1fr]`}>
            <aside className="border-b border-stone-200/70 bg-stone-900/[0.025] p-4 lg:border-b-0 lg:border-r">
              <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">{t.roles}</p>
              <div className="space-y-1.5">
                {roles.map(role => (
                  <button
                    type="button"
                    key={role.id}
                    onClick={() => handleRoleSelect(role.id)}
                    className={`w-full rounded-xl px-3.5 py-3 text-left transition ${
                      selectedRole === role.id
                        ? 'bg-[#1A1714] text-white shadow-[0_3px_14px_rgba(26,23,20,0.16)]'
                        : 'text-[#1A1714] hover:bg-white/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{roleLabel(role, lang)[0]}</span>
                      {role.is_system_role && <LockKeyhole className="h-3.5 w-3.5 opacity-55" />}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 opacity-60">{roleLabel(role, lang)[1]}</p>
                  </button>
                ))}
              </div>
            </aside>

            <section className="min-w-0 p-5 sm:p-6">
              {selectedRole ? (
                <>
                  <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <h3 className="text-base font-semibold tracking-tight text-[#1A1714]">
                        {fillText(t.rolePermissions, { role: selectedRoleRecord ? roleLabel(selectedRoleRecord, lang)[0] : '' })}
                      </h3>
                      <p className="mt-1 text-sm text-stone-500">{t.roleHint}</p>
                    </div>
                    {roles.find(role => role.id === selectedRole)?.is_system_role && (
                      <span className={`${ADMIN_STATUS_PILL} bg-amber-50 text-amber-700`}>
                        <LockKeyhole className="h-3.5 w-3.5" /> {t.systemRole}
                      </span>
                    )}
                  </div>
                  <div className="space-y-7">
                    {Object.entries(permissionsByCategory).map(([category, perms]) => (
                      <div key={category}>
                        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">{categoryLabel(category, lang)}</h4>
                        <div className="divide-y divide-stone-200/60 rounded-xl bg-stone-900/[0.025] px-3">
                          {perms.map(permission => (
                            <label key={permission.id} className="flex cursor-pointer items-start gap-3 px-1 py-3.5">
                              <input
                                type="checkbox"
                                checked={rolePermissions.includes(permission.id)}
                                onChange={() => togglePermission(permission.id)}
                                disabled={roles.find(role => role.id === selectedRole)?.is_system_role}
                                className="mt-0.5 h-4 w-4 rounded border-stone-300 accent-[#1A1714] disabled:opacity-40"
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-[#1A1714]">{permissionLabel(permission, lang)[0]}</span>
                                <span className="mt-0.5 block text-xs leading-5 text-stone-400">{permissionLabel(permission, lang)[1]}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center text-center">
                  <Shield className="mb-3 h-6 w-6 text-stone-300" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-[#1A1714]">{t.selectRole}</p>
                  <p className="mt-1 text-xs text-stone-400">{t.selectRoleHint}</p>
                </div>
              )}
            </section>
          </div>
        )
      )}

      {showInviteModal && (
        <div className={ADMIN_MODAL_BACKDROP}>
          <div className={`${ADMIN_MODAL} max-w-lg p-6 sm:p-7`} role="dialog" aria-modal="true" aria-labelledby="invite-team-title">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 id="invite-team-title" className="text-lg font-semibold tracking-tight text-[#1A1714]">{t.inviteTitle}</h2>
                <p className="mt-1 text-sm text-stone-500">{t.inviteBody}</p>
              </div>
              <button type="button" onClick={() => setShowInviteModal(false)} className="rounded-xl p-2 text-stone-500 transition hover:bg-stone-900/[0.05] hover:text-[#1A1714]" aria-label={t.close}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {inviteError && (
              <div className="mb-4 rounded-xl border border-red-200/80 bg-red-50/70 p-3 text-sm text-red-700">
                {inviteError}
              </div>
            )}

            <form onSubmit={handleInviteStaff} className="space-y-4">
              <div>
                <label htmlFor="invite-full-name" className="mb-2 block text-sm font-medium text-stone-700">{t.fullName}</label>
                <input
                  id="invite-full-name"
                  type="text"
                  value={inviteForm.full_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                  className={ADMIN_INPUT}
                  required
                />
              </div>

              <div>
                <label htmlFor="invite-email" className="mb-2 block text-sm font-medium text-stone-700">{t.emailAddress}</label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className={ADMIN_INPUT}
                  required
                />
              </div>

              <div>
                <label htmlFor="invite-role" className="mb-2 block text-sm font-medium text-stone-700">{t.primaryRole}</label>
                <select
                  id="invite-role"
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className={ADMIN_SELECT}
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
                  className={`${ADMIN_SECONDARY_BUTTON} flex-1`}
                  disabled={inviting}
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className={`${ADMIN_PRIMARY_BUTTON} flex-1`}
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
