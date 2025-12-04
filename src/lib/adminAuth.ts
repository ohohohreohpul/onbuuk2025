import { supabase } from './supabase';

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'staff';
  is_active: boolean;
  business_id: string;
  specialist_id?: string;
}

const ADMIN_KEY = 'admin_user';

export const adminAuth = {
  login: async (email: string, password: string, businessId?: string): Promise<AdminUser | null> => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        console.error('Supabase auth error:', authError);
        return null;
      }

      let query = supabase
        .from('admin_users')
        .select('*')
        .eq('email', email)
        .eq('is_active', true);

      if (businessId) {
        console.log('Searching for admin with businessId:', businessId);
        query = query.eq('business_id', businessId);
      } else {
        console.log('Searching for admin without businessId filter');
      }

      const { data, error } = await query.maybeSingle();

      console.log('Query result:', { data, error, businessId });

      if (error) {
        console.error('Database error:', error);
        await supabase.auth.signOut();
        return null;
      }

      if (!data) {
        console.error('No admin user found with email:', email, businessId ? `for business: ${businessId}` : '');
        await supabase.auth.signOut();
        return null;
      }

      const adminUser: AdminUser = {
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        is_active: data.is_active,
        business_id: data.business_id,
        specialist_id: data.specialist_id,
      };

      localStorage.setItem(ADMIN_KEY, JSON.stringify(adminUser));

      await supabase
        .from('admin_users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.id);

      return adminUser;
    } catch (err) {
      console.error('Login error:', err);
      return null;
    }
  },

  logout: async () => {
    localStorage.removeItem(ADMIN_KEY);
    await supabase.auth.signOut();
  },

  getCurrentUser: (): AdminUser | null => {
    const stored = localStorage.getItem(ADMIN_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  },

  isAuthenticated: (): boolean => {
    return adminAuth.getCurrentUser() !== null;
  },
};
