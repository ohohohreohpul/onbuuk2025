import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Permission {
  code: string;
  name: string;
  category: string;
}

export interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string;
  is_system_role: boolean;
}

export function usePermissions(adminUserId: string | null) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [legacyRole, setLegacyRole] = useState<string | null>(null);

  useEffect(() => {
    if (!adminUserId) {
      setPermissions([]);
      setRoles([]);
      setLegacyRole(null);
      setLoading(false);
      return;
    }

    loadPermissions();
  }, [adminUserId]);

  const loadPermissions = async () => {
    try {
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('role')
        .eq('id', adminUserId)
        .single();

      if (adminUser) {
        setLegacyRole(adminUser.role);

        if (adminUser.role === 'owner') {
          const { data: allPerms } = await supabase
            .from('permissions')
            .select('code, name, category');

          if (allPerms) {
            setPermissions(allPerms);
            setLoading(false);
            return;
          }
        }
      }

      const { data: userRoles } = await supabase
        .from('admin_user_roles')
        .select(`
          role_id,
          roles!inner (
            id,
            name,
            display_name,
            description,
            is_system_role
          )
        `)
        .eq('admin_user_id', adminUserId);

      if (userRoles && userRoles.length > 0) {
        const roleIds = userRoles.map(ur => ur.role_id);
        setRoles(userRoles.map(ur => ur.roles as unknown as Role));

        const { data: rolePermissions } = await supabase
          .from('role_permissions')
          .select(`
            permissions!inner (
              code,
              name,
              category
            )
          `)
          .in('role_id', roleIds);

        if (rolePermissions) {
          const uniquePermissions = Array.from(
            new Map(
              rolePermissions.map(rp => [
                (rp.permissions as any).code,
                rp.permissions as unknown as Permission
              ])
            ).values()
          );
          setPermissions(uniquePermissions);
        }
      } else if (adminUser?.role === 'admin') {
        const { data: allPerms } = await supabase
          .from('permissions')
          .select('code, name, category');

        if (allPerms) {
          setPermissions(allPerms);
        }
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permissionCode: string): boolean => {
    return permissions.some(p => p.code === permissionCode);
  };

  const hasAnyPermission = (permissionCodes: string[]): boolean => {
    return permissionCodes.some(code => hasPermission(code));
  };

  const hasAllPermissions = (permissionCodes: string[]): boolean => {
    return permissionCodes.every(code => hasPermission(code));
  };

  const hasRole = (roleName: string): boolean => {
    return roles.some(r => r.name === roleName);
  };

  return {
    permissions,
    roles,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    legacyRole,
  };
}
