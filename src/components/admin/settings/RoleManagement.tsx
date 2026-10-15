import { useState, useEffect } from 'react';
import { Shield, Users, Plus, X, Edit2, Save } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../lib/tenantContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { adminAuth } from '../../../lib/adminAuth';
import { useAdminText } from '../../../lib/adminLanguage';
import { categoryLabel, permissionLabel, roleLabel } from '../roleLabels';
import type { Translations } from '../../../lib/bookingLanguage';

const TEXT: Translations<{
  systemLocked: string; allRequired: string; passwordTooShort: string; createFailed: string; loading: string;
  title: string; rolesTab: string; assignmentsTab: string; roles: string; systemRole: string; permissions: string;
  selectRole: string; addUser: string; user: string; email: string; assignedRoles: string; actions: string;
  removeRole: string; addRole: string; addUserTitle: string; close: string; fullName: string; namePlaceholder: string;
  password: string; passwordPlaceholder: string; initialRole: string; roleStaff: string; roleAdmin: string;
  cancel: string; creating: string; createUser: string; noPermission: string;
}> = {
  en: {
    systemLocked: 'System roles cannot be modified', allRequired: 'All fields are required',
    passwordTooShort: 'Password must be at least 8 characters', createFailed: 'Failed to create user',
    loading: 'Loading roles and permissions...', title: 'Role Management', rolesTab: 'Roles & Permissions',
    assignmentsTab: 'User Assignments', roles: 'Roles', systemRole: 'System Role', permissions: 'Permissions',
    selectRole: 'Select a role to view and manage permissions', addUser: 'Add User', user: 'User', email: 'Email',
    assignedRoles: 'Assigned Roles', actions: 'Actions', removeRole: 'Remove role', addRole: 'Add role...',
    addUserTitle: 'Add New User', close: 'Close', fullName: 'Full Name', namePlaceholder: 'John Doe', password: 'Password',
    passwordPlaceholder: 'Minimum 8 characters', initialRole: 'Initial Role', roleStaff: 'Staff', roleAdmin: 'Admin',
    cancel: 'Cancel', creating: 'Creating...', createUser: 'Create User',
    noPermission: 'You do not have permission to manage roles and assignments.',
  },
  de: {
    systemLocked: 'System-Rollen können nicht geändert werden', allRequired: 'Bitte alle Felder ausfüllen',
    passwordTooShort: 'Das Passwort muss mindestens 8 Zeichen lang sein', createFailed: 'Benutzer konnte nicht angelegt werden',
    loading: 'Rollen und Berechtigungen werden geladen…', title: 'Rollenverwaltung', rolesTab: 'Rollen & Berechtigungen',
    assignmentsTab: 'Zuweisungen', roles: 'Rollen', systemRole: 'System-Rolle', permissions: 'Berechtigungen',
    selectRole: 'Rolle auswählen, um ihre Berechtigungen zu sehen und zu verwalten', addUser: 'Benutzer hinzufügen', user: 'Benutzer', email: 'E-Mail',
    assignedRoles: 'Zugewiesene Rollen', actions: 'Aktionen', removeRole: 'Rolle entfernen', addRole: 'Rolle hinzufügen…',
    addUserTitle: 'Neuen Benutzer hinzufügen', close: 'Schließen', fullName: 'Vollständiger Name', namePlaceholder: 'Max Mustermann', password: 'Passwort',
    passwordPlaceholder: 'Mindestens 8 Zeichen', initialRole: 'Anfangsrolle', roleStaff: 'Mitarbeiter:in', roleAdmin: 'Admin',
    cancel: 'Abbrechen', creating: 'Wird angelegt…', createUser: 'Benutzer anlegen',
    noPermission: 'Sie haben keine Berechtigung, Rollen und Zuweisungen zu verwalten.',
  },
  th: {
    systemLocked: 'แก้ไขบทบาทของระบบไม่ได้', allRequired: 'กรุณากรอกข้อมูลให้ครบทุกช่อง',
    passwordTooShort: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร', createFailed: 'สร้างผู้ใช้ไม่สำเร็จ',
    loading: 'กำลังโหลดบทบาทและสิทธิ์…', title: 'จัดการบทบาท', rolesTab: 'บทบาทและสิทธิ์',
    assignmentsTab: 'การกำหนดบทบาทผู้ใช้', roles: 'บทบาท', systemRole: 'บทบาทของระบบ', permissions: 'สิทธิ์',
    selectRole: 'เลือกบทบาทเพื่อดูและจัดการสิทธิ์', addUser: 'เพิ่มผู้ใช้', user: 'ผู้ใช้', email: 'อีเมล',
    assignedRoles: 'บทบาทที่ได้รับ', actions: 'การดำเนินการ', removeRole: 'นำบทบาทออก', addRole: 'เพิ่มบทบาท…',
    addUserTitle: 'เพิ่มผู้ใช้ใหม่', close: 'ปิด', fullName: 'ชื่อ-นามสกุล', namePlaceholder: 'สมชาย ใจดี', password: 'รหัสผ่าน',
    passwordPlaceholder: 'อย่างน้อย 8 ตัวอักษร', initialRole: 'บทบาทเริ่มต้น', roleStaff: 'พนักงาน', roleAdmin: 'ผู้ดูแล',
    cancel: 'ยกเลิก', creating: 'กำลังสร้าง…', createUser: 'สร้างผู้ใช้',
    noPermission: 'คุณไม่มีสิทธิ์จัดการบทบาทและการกำหนดบทบาท',
  },
};


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
  const { t, lang } = useAdminText(TEXT);
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
      alert(t.systemLocked);
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
        setAddUserError(t.allRequired);
        setAddingUser(false);
        return;
      }

      if (newUserForm.password.length < 8) {
        setAddUserError(t.passwordTooShort);
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
      setAddUserError(error.message || t.createFailed);
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
    return <div className="text-stone-600">{t.loading}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Shield className="w-6 h-6 text-stone-700" />
        <h2 className="text-2xl font-light text-stone-900">{t.title}</h2>
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
          {t.rolesTab}
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'assignments'
              ? 'text-stone-900 border-b-2 border-stone-900'
              : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          {t.assignmentsTab}
        </button>
      </div>

      {activeTab === 'roles' && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1 bg-white rounded-lg border border-stone-200 p-4">
            <h3 className="text-lg font-medium text-stone-900 mb-4">{t.roles}</h3>
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
                  <div className="font-medium">{roleLabel(role, lang)[0]}</div>
                  <div className="text-xs opacity-75 mt-1">{roleLabel(role, lang)[1]}</div>
                  {role.is_system_role && (
                    <div className="text-xs mt-1 opacity-60">{t.systemRole}</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-2 bg-white rounded-lg border border-stone-200 p-6">
            {selectedRole ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-stone-900">{t.permissions}</h3>
                  {roles.find(r => r.id === selectedRole)?.is_system_role && (
                    <span className="text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded">
                      {t.systemLocked}
                    </span>
                  )}
                </div>
                <div className="space-y-6">
                  {Object.entries(permissionsByCategory).map(([category, perms]) => (
                    <div key={category}>
                      <h4 className="text-sm font-medium text-stone-700 uppercase tracking-wide mb-3">
                        {categoryLabel(category, lang)}
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
                              <div className="text-sm font-medium text-stone-900">{permissionLabel(perm, lang)[0]}</div>
                              <div className="text-xs text-stone-500 mt-1">{permissionLabel(perm, lang)[1]}</div>
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
                {t.selectRole}
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
                <span>{t.addUser}</span>
              </button>
            )}
          </div>
          <div className="bg-white rounded-lg border border-stone-200">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left p-4 text-sm font-medium text-stone-700">{t.user}</th>
                <th className="text-left p-4 text-sm font-medium text-stone-700">{t.email}</th>
                <th className="text-left p-4 text-sm font-medium text-stone-700">{t.assignedRoles}</th>
                <th className="text-left p-4 text-sm font-medium text-stone-700">{t.actions}</th>
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
                          <span>{roleLabel(role, lang)[0]}</span>
                          {canAssignRoles && (
                            <button
                              onClick={() => removeRoleFromUser(user.id, role.id)}
                              className="ml-1 hover:text-red-600"
                              aria-label={t.removeRole}
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
                        <option value="" disabled>{t.addRole}</option>
                        {roles
                          .filter(role => !user.roles.some(ur => ur.id === role.id))
                          .map(role => (
                            <option key={role.id} value={role.id}>
                              {roleLabel(role, lang)[0]}
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
              <h3 className="text-xl font-medium text-stone-900">{t.addUserTitle}</h3>
              <button
                onClick={() => {
                  setShowAddUserModal(false);
                  setAddUserError('');
                  setNewUserForm({ email: '', password: '', full_name: '', role: 'staff' });
                }}
                className="text-stone-400 hover:text-stone-600"
                aria-label={t.close}
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
                  {t.fullName}
                </label>
                <input
                  type="text"
                  value={newUserForm.full_name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                  placeholder={t.namePlaceholder}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  {t.email}
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
                  {t.password}
                </label>
                <input
                  type="password"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                  placeholder={t.passwordPlaceholder}
                />
                <p className="text-xs text-stone-500 mt-1">{t.passwordTooShort}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  {t.initialRole}
                </label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as 'admin' | 'staff' })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                >
                  <option value="staff">{t.roleStaff}</option>
                  <option value="admin">{t.roleAdmin}</option>
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
                {t.cancel}
              </button>
              <button
                onClick={createNewUser}
                disabled={addingUser}
                className="flex-1 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingUser ? t.creating : t.createUser}
              </button>
            </div>
          </div>
        </div>
      )}

      {!canAssignRoles && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
          {t.noPermission}
        </div>
      )}
    </div>
  );
}
