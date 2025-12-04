import { useState, useEffect } from 'react';
import { Shield, Users, Plus, X, Edit2, Save } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../lib/tenantContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { adminAuth } from '../../../lib/adminAuth';

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

export default function RoleManagement() {
  const { businessId } = useTenant();
  const adminUser = adminAuth.getCurrentUser();
  const { hasPermission } = usePermissions(adminUser?.id || null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<AdminUserWithRoles[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'roles' | 'assignments'>('roles');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'staff' as 'admin' | 'staff'
  });
  const [addUserError, setAddUserError] = useState('');
  const [addingUser, setAddingUser] = useState(false);

  const canAssignRoles = hasPermission('assign_roles');

  useEffect(() => {
    loadData();
  }, [businessId]);

  const loadData = async () => {
    if (!businessId) return;

    setLoading(true);
    try {
      const [rolesRes, permsRes, usersRes] = await Promise.all([
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
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
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

      await loadData();
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

      await loadData();
    } catch (error) {
      console.error('Error removing role:', error);
    }
  };

  const createNewUser = async () => {
    if (!canAssignRoles || !businessId) return;

    setAddUserError('');
    setAddingUser(true);

    try {
      if (!newUserForm.email || !newUserForm.password || !newUserForm.full_name) {
        setAddUserError('All fields are required');
        setAddingUser(false);
        return;
      }

      if (newUserForm.password.length < 8) {
        setAddUserError('Password must be at least 8 characters');
        setAddingUser(false);
        return;
      }

      const { data, error } = await supabase.rpc('create_admin_user', {
        p_email: newUserForm.email,
        p_password: newUserForm.password,
        p_full_name: newUserForm.full_name,
        p_role: newUserForm.role,
        p_business_id: businessId
      });

      if (error) throw error;

      setShowAddUserModal(false);
      setNewUserForm({ email: '', password: '', full_name: '', role: 'staff' });
      await loadData();
    } catch (error: any) {
      console.error('Error creating user:', error);
      setAddUserError(error.message || 'Failed to create user');
    } finally {
      setAddingUser(false);
    }
  };

  const permissionsByCategory = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (loading) {
    return <div className="text-stone-600">Loading roles and permissions...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Shield className="w-6 h-6 text-stone-700" />
        <h2 className="text-2xl font-light text-stone-900">Role Management</h2>
      </div>

      <div className="flex space-x-2 border-b border-stone-200">
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'roles'
              ? 'text-stone-900 border-b-2 border-stone-900'
              : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          Roles & Permissions
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'assignments'
              ? 'text-stone-900 border-b-2 border-stone-900'
              : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          User Assignments
        </button>
      </div>

      {activeTab === 'roles' && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1 bg-white rounded-lg border border-stone-200 p-4">
            <h3 className="text-lg font-medium text-stone-900 mb-4">Roles</h3>
            <div className="space-y-2">
              {roles.map(role => (
                <button
                  key={role.id}
                  onClick={() => handleRoleSelect(role.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    selectedRole === role.id
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-50 text-stone-900 hover:bg-stone-100'
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

          <div className="col-span-2 bg-white rounded-lg border border-stone-200 p-6">
            {selectedRole ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-stone-900">Permissions</h3>
                  {roles.find(r => r.id === selectedRole)?.is_system_role && (
                    <span className="text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded">
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
                            className="flex items-start space-x-3 p-3 rounded-lg hover:bg-stone-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={rolePermissions.includes(perm.id)}
                              onChange={() => togglePermission(perm.id)}
                              disabled={!canAssignRoles || roles.find(r => r.id === selectedRole)?.is_system_role}
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

      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            {canAssignRoles && (
              <button
                onClick={() => setShowAddUserModal(true)}
                className="flex items-center space-x-2 bg-stone-900 text-white px-4 py-2 rounded-lg hover:bg-stone-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add User</span>
              </button>
            )}
          </div>
          <div className="bg-white rounded-lg border border-stone-200">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left p-4 text-sm font-medium text-stone-700">User</th>
                <th className="text-left p-4 text-sm font-medium text-stone-700">Email</th>
                <th className="text-left p-4 text-sm font-medium text-stone-700">Assigned Roles</th>
                <th className="text-left p-4 text-sm font-medium text-stone-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b border-stone-100 hover:bg-stone-50">
                  <td className="p-4 text-sm text-stone-900">{user.full_name}</td>
                  <td className="p-4 text-sm text-stone-600">{user.email}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {user.roles.map(role => (
                        <span
                          key={role.id}
                          className="inline-flex items-center space-x-1 bg-stone-100 text-stone-700 px-3 py-1 rounded-full text-xs"
                        >
                          <span>{role.display_name}</span>
                          {canAssignRoles && (
                            <button
                              onClick={() => removeRoleFromUser(user.id, role.id)}
                              className="ml-1 hover:text-red-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4">
                    {canAssignRoles && (
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            assignRoleToUser(user.id, e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="text-sm border border-stone-300 rounded-lg px-3 py-1"
                        defaultValue=""
                      >
                        <option value="" disabled>Add role...</option>
                        {roles
                          .filter(role => !user.roles.some(ur => ur.id === role.id))
                          .map(role => (
                            <option key={role.id} value={role.id}>
                              {role.display_name}
                            </option>
                          ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-medium text-stone-900">Add New User</h3>
              <button
                onClick={() => {
                  setShowAddUserModal(false);
                  setAddUserError('');
                  setNewUserForm({ email: '', password: '', full_name: '', role: 'staff' });
                }}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addUserError && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4 text-sm">
                {addUserError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newUserForm.full_name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                  placeholder="Minimum 8 characters"
                />
                <p className="text-xs text-stone-500 mt-1">Password must be at least 8 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Initial Role
                </label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as 'admin' | 'staff' })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowAddUserModal(false);
                  setAddUserError('');
                  setNewUserForm({ email: '', password: '', full_name: '', role: 'staff' });
                }}
                className="flex-1 px-4 py-2 border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors"
                disabled={addingUser}
              >
                Cancel
              </button>
              <button
                onClick={createNewUser}
                disabled={addingUser}
                className="flex-1 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingUser ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!canAssignRoles && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
          You do not have permission to manage roles and assignments.
        </div>
      )}
    </div>
  );
}
