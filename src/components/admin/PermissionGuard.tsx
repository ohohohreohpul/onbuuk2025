import { ReactNode } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { adminAuth } from '../../lib/adminAuth';
import { AlertCircle } from 'lucide-react';

interface PermissionGuardProps {
  children: ReactNode;
  permission: string | string[];
  requireAll?: boolean;
  fallback?: ReactNode;
}

export default function PermissionGuard({
  children,
  permission,
  requireAll = false,
  fallback
}: PermissionGuardProps) {
  const adminUser = adminAuth.getCurrentUser();
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = usePermissions(adminUser?.id || null);

  if (loading) {
    return <div className="text-stone-600">Loading permissions...</div>;
  }

  const permissions = Array.isArray(permission) ? permission : [permission];

  const hasAccess = requireAll
    ? hasAllPermissions(permissions)
    : hasAnyPermission(permissions);

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
        <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-amber-900 mb-2">Access Restricted</h3>
        <p className="text-amber-700">
          You do not have permission to access this feature. Contact your administrator to request access.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
