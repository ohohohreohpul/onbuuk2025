import { useState, useEffect } from 'react';
import { Users, Plus, Mail, Clock, X, Trash2, RefreshCw, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';
import { adminAuth } from '../../lib/adminAuth';
import { usePermissions } from '../../hooks/usePermissions';

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
      alert('System roles cannot be modified');
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

      alert('Invitation sent successfully!');
    } catch (err: any) {
      console.error('Error sending invitation:', err);
      setInviteError(err.message || 'Failed to send invitation');
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
      alert(`Invitation resent to ${invitation.email}`);
    } catch (err) {
      console.error('Error resending invitation:', err);
      alert('Failed to resend invitation');
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;

    try {
      const { error } = await supabase
        .from('staff_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      await fetchData();
      alert('Invitation cancelled');
    } catch (err) {
      console.error('Error cancelling invitation:', err);
      alert('Failed to cancel invitation');
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
      alert('Failed to update staff status');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-blue-100 text-blue-800';
      case 'admin':
      case 'manager':
        return 'bg-green-100 text-green-800';
      case 'receptionist':
        return 'bg-amber-100 text-amber-800';
      case 'cashier':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-stone-600">Loading team...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 mb-2">Team & Permissions</h1>
          <p className="text-stone-600">Manage your team members, invitations, and role-based permissions</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-stone-900 text-white hover:bg-stone-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Invite Team Member
        </button>
      </div>

      <div className="bg-white shadow">
        <div className="border-b border-stone-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('team')}
              className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                activeTab === 'team'
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Team Members ({staff.length})
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
                Invitations ({invitations.filter(inv => !inv.is_used).length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('roles')}
              className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                activeTab === 'roles'
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Roles & Permissions ({roles.length})
              </div>
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'team' && (
            <div className="space-y-4">
              {staff.length === 0 ? (
                <div className="text-center py-12 text-stone-500">
                  <Users className="w-16 h-16 mx-auto mb-4 text-stone-300" />
                  <p>No team members yet. Invite your first team member!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-stone-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-stone-700">Name</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-stone-700">Email</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-stone-700">Role</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-stone-700">Advanced Roles</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-stone-700">Last Login</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-stone-700">Status</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-stone-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.map((member) => {
                        const userWithRoles = users.find(u => u.id === member.id);
                        return (
                          <tr key={member.id} className="border-b border-stone-100 hover:bg-stone-50">
                            <td className="py-4 px-4">
                              <div className="font-medium text-stone-900">{member.full_name}</div>
                            </td>
                            <td className="py-4 px-4 text-stone-600">{member.email}</td>
                            <td className="py-4 px-4">
                              <span className={`px-3 py-1 text-xs font-semibold uppercase ${getRoleBadgeColor(member.role)}`}>
                                {member.role}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex flex-wrap gap-2">
                                {userWithRoles?.roles.map(role => (
                                  <span
                                    key={role.id}
                                    className="inline-flex items-center space-x-1 bg-stone-100 text-stone-700 px-2 py-1 text-xs"
                                  >
                                    <span>{role.display_name}</span>
                                    {canAssignRoles && member.id !== currentUser?.id && (
                                      <button
                                        onClick={() => removeRoleFromUser(member.id, role.id)}
                                        className="ml-1 hover:text-red-600"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </span>
                                ))}
                                {canAssignRoles && member.id !== currentUser?.id && (
                                  <select
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        assignRoleToUser(member.id, e.target.value);
                                        e.target.value = '';
                                      }
                                    }}
                                    className="text-xs border border-stone-300 px-2 py-1"
                                    defaultValue=""
                                  >
                                    <option value="" disabled>+ Add role</option>
                                    {roles
                                      .filter(role => !userWithRoles?.roles.some(ur => ur.id === role.id))
                                      .map(role => (
                                        <option key={role.id} value={role.id}>
                                          {role.display_name}
                                        </option>
                                      ))}
                                  </select>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4 text-sm text-stone-600">
                              {member.last_login ? formatDate(member.last_login) : 'Never'}
                            </td>
                            <td className="py-4 px-4">
                              <span
                                className={`px-3 py-1 text-xs font-semibold ${
                                  member.is_active
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {member.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              {member.id !== currentUser?.id && (
                                <button
                                  onClick={() => handleToggleStaffStatus(member.id, member.is_active)}
                                  className="text-sm text-stone-600 hover:text-stone-900"
                                >
                                  {member.is_active ? 'Deactivate' : 'Activate'}
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
            <div className="space-y-4">
              {invitations.filter(inv => !inv.is_used).length === 0 ? (
                <div className="text-center py-12 text-stone-500">
                  <Mail className="w-16 h-16 mx-auto mb-4 text-stone-300" />
                  <p>No pending invitations</p>
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
                              {invitation.role}
                            </span>
                            {isExpired(invitation.expires_at) && (
                              <span className="px-3 py-1 text-xs font-semibold bg-red-100 text-red-800">
                                Expired
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-stone-600 mb-1">{invitation.email}</p>
                          <div className="flex items-center gap-4 text-xs text-stone-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Sent {formatDate(invitation.created_at)}
                            </span>
                            <span>Expires {formatDate(invitation.expires_at)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleResendInvitation(invitation)}
                            className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                            title="Resend invitation"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleCancelInvitation(invitation.id)}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50"
                            title="Cancel invitation"
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

          {activeTab === 'roles' && (
            <div>
              {!canAssignRoles ? (
                <div className="bg-amber-50 border border-amber-200 p-4 text-amber-800 text-sm">
                  You do not have permission to manage roles and permissions.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-6">
                  <div className="col-span-1 bg-stone-50 p-4">
                    <h3 className="text-lg font-medium text-stone-900 mb-4">Roles</h3>
                    <div className="space-y-2">
                      {roles.map(role => (
                        <button
                          key={role.id}
                          onClick={() => handleRoleSelect(role.id)}
                          className={`w-full text-left px-4 py-3 transition-colors ${
                            selectedRole === role.id
                              ? 'bg-stone-900 text-white'
                              : 'bg-white text-stone-900 hover:bg-stone-100 border border-stone-200'
                          }`}
                        >
                          <div className="font-medium">{role.display_name}</div>
                          <div className="text-xs opacity-75 mt-1">{role.description}</div>
                          {role.is_system_role && (
                            <div className="text-xs mt-1 opacity-60">System Role</div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-2 bg-white border border-stone-200 p-6">
                    {selectedRole ? (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-medium text-stone-900">Permissions</h3>
                          {roles.find(r => r.id === selectedRole)?.is_system_role && (
                            <span className="text-sm text-amber-600 bg-amber-50 px-3 py-1">
                              System roles cannot be modified
                            </span>
                          )}
                        </div>
                        <div className="space-y-6">
                          {Object.entries(permissionsByCategory).map(([category, perms]) => (
                            <div key={category}>
                              <h4 className="text-sm font-medium text-stone-700 uppercase tracking-wide mb-3">
                                {category}
                              </h4>
                              <div className="space-y-2">
                                {perms.map(perm => (
                                  <label
                                    key={perm.id}
                                    className="flex items-start space-x-3 p-3 hover:bg-stone-50 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={rolePermissions.includes(perm.id)}
                                      onChange={() => togglePermission(perm.id)}
                                      disabled={roles.find(r => r.id === selectedRole)?.is_system_role}
                                      className="mt-1"
                                    />
                                    <div className="flex-1">
                                      <div className="text-sm font-medium text-stone-900">{perm.name}</div>
                                      <div className="text-xs text-stone-500 mt-1">{perm.description}</div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-stone-500 py-12">
                        Select a role to view and manage permissions
                      </div>
                    )}
                  </div>
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
              <h2 className="text-2xl font-bold text-stone-900">Invite Team Member</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-stone-500 hover:text-stone-700">
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
                <label className="block text-sm font-medium text-stone-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={inviteForm.full_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-stone-300 focus:ring-2 focus:ring-stone-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Email</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full px-4 py-2 border border-stone-300 focus:ring-2 focus:ring-stone-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Role</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className="w-full px-4 py-2 border border-stone-300 focus:ring-2 focus:ring-stone-500 focus:border-transparent"
                >
                  <option value="staff">Staff</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-3 border border-stone-300 text-stone-700 hover:bg-stone-50"
                  disabled={inviting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-50"
                  disabled={inviting}
                >
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
