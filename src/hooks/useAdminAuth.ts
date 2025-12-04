import { adminAuth, AdminUser } from '../lib/adminAuth';

export function useAdminAuth(): AdminUser | null {
  return adminAuth.getCurrentUser();
}
