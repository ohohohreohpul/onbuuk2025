import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { executeWithTimeout } from '../lib/queryUtils';

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

const PERMISSIONS_TIMEOUT = 5000;

export function usePermissions(adminUserId: string | null) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [legacyRole, setLegacyRole] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    if (!adminUserId) {
      setPermissions([]);
      setRoles([]);
      setLegacyRole(null);
      setLoading(false);
      return;
    }

    loadPermissions();

    return () => {
      mountedRef.current = false;
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [adminUserId]);

  const loadPermissions = async () => {
    if (!adminUserId || !mountedRef.current) return;

    loadTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current && loading) {
        console.warn('Permissions loading timeout - using default permissions');
        setLoading(false);
      }
    }, PERMISSIONS_TIMEOUT);

    try {
      const adminUserResult = await executeWithTimeout(
        supabase
          .from('admin_users')
          .select('role')
          .eq('id', adminUserId)
          .single(),
        { timeout: 3000, retries: 2 }
      );

      if (adminUserResult.error) {
        throw adminUserResult.error;
      }

      const adminUser = adminUserResult.data;

      if (mountedRef.current) {
        setLegacyRole(adminUser.role);

        if (adminUser.role === 'owner') {
          const allPermsResult = await executeWithTimeout(
            supabase
              .from('permissions')
              .select('code, name, category'),
            { timeout: 3000, retries: 1 }
          );

          if (allPermsResult.data && mountedRef.current) {
            setPermissions(allPermsResult.data);
            setLoading(false);
            if (loadTimeoutRef.current) {
              clearTimeout(loadTimeoutRef.current);
            }
            return;
          }
        }
      }

      const userRolesResult = await executeWithTimeout(
        supabase
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
          .eq('admin_user_id', adminUserId),
        { timeout: 3000, retries: 1 }
      );

      if (userRolesResult.data && userRolesResult.data.length > 0 && mountedRef.current) {
        const userRoles = userRolesResult.data;
        const roleIds = userRoles.map(ur => ur.role_id);
        setRoles(userRoles.map(ur => ur.roles as unknown as Role));

        const rolePermsResult = await executeWithTimeout(
          supabase
            .from('role_permissions')
            .select(`
              permissions!inner (
                code,
                name,
                category
              )
            `)
            .in('role_id', roleIds),
          { timeout: 3000, retries: 1 }
        );

        if (rolePermsResult.data && mountedRef.current) {
          const uniquePermissions = Array.from(
            new Map(
              rolePermsResult.data.map(rp => [
                (rp.permissions as any).code,
                rp.permissions as unknown as Permission
              ])
            ).values()
          );
          setPermissions(uniquePermissions);
        }
      } else if (adminUser?.role === 'admin' && mountedRef.current) {
        const allPermsResult = await executeWithTimeout(
          supabase
            .from('permissions')
            .select('code, name, category'),
          { timeout: 3000, retries: 1 }
        );

        if (allPermsResult.data && mountedRef.current) {
          setPermissions(allPermsResult.data);
        }
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
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
