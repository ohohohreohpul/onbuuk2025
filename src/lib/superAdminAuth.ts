import { supabase } from './supabase';

export interface SuperAdminUser {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  last_login: string | null;
}

const SUPER_ADMIN_KEY = 'super_admin_user';

export const superAdminAuth = {
  login: async (email: string, password: string): Promise<SuperAdminUser | null> => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        console.error('Auth error:', authError);
        return null;
      }

      const { data, error } = await supabase.rpc('check_super_admin_by_email', {
        p_email: email
      });

      if (error || !data || data.length === 0) {
        console.error('Not a super admin:', error);
        await supabase.auth.signOut();
        return null;
      }

      const superAdmin = data[0];

      await supabase
        .from('super_admins')
        .update({ last_login: new Date().toISOString() })
        .eq('id', superAdmin.id);

      const superAdminUser: SuperAdminUser = {
        id: superAdmin.id,
        email: superAdmin.email,
        full_name: superAdmin.full_name,
        is_active: superAdmin.is_active,
        last_login: superAdmin.last_login,
      };

      localStorage.setItem(SUPER_ADMIN_KEY, JSON.stringify(superAdminUser));

      return superAdminUser;
    } catch (err) {
      console.error('Super admin login error:', err);
      return null;
    }
  },

  logout: async () => {
    localStorage.removeItem(SUPER_ADMIN_KEY);
    await supabase.auth.signOut();
  },

  getCurrentUser: (): SuperAdminUser | null => {
    const stored = localStorage.getItem(SUPER_ADMIN_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  },

  isAuthenticated: (): boolean => {
    return superAdminAuth.getCurrentUser() !== null;
  },
};
