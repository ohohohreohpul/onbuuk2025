import { ReactNode, useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Briefcase,
  UserCircle,
  Settings,
  LogOut,
  Palette,
  HelpCircle,
  Book,
  ExternalLink,
  Gift,
  DollarSign,
  Package,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { adminAuth } from '../../lib/adminAuth';
import { useTenant } from '../../lib/tenantContext';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import ProfileCompletionBanner from './ProfileCompletionBanner';

interface AdminLayoutProps {
  children: ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
  onLogout: () => void;
}

export default function AdminLayout({ children, currentView, onViewChange, onLogout }: AdminLayoutProps) {
  const adminUser = adminAuth.getCurrentUser();
  const { businessId } = useTenant();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const { hasPermission, hasAnyPermission, loading } = usePermissions(adminUser?.id || null);

  useEffect(() => {
    async function fetchLogo() {
      if (!businessId) return;

      const { data } = await supabase
        .from('businesses')
        .select('custom_logo_url, logo_url')
        .eq('id', businessId)
        .maybeSingle();

      if (data?.custom_logo_url || data?.logo_url) {
        setLogoUrl(data.custom_logo_url || data.logo_url);
      }
    }

    fetchLogo();
  }, [businessId]);

  const [expandedGroups, setExpandedGroups] = useState<string[]>(['operations', 'business']);

  const allMenuGroups = [
    {
      id: 'main',
      label: null,
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permissions: ['view_reports'] },
      ]
    },
    {
      id: 'operations',
      label: 'Operations',
      items: [
        { id: 'calendar', label: 'Calendar', icon: Calendar, permissions: ['view_own_calendar', 'view_all_calendars'] },
        { id: 'bookings', label: 'Bookings', icon: Calendar, permissions: ['view_own_bookings', 'view_all_bookings'] },
        { id: 'customers', label: 'Customers', icon: Users, permissions: ['view_customers'] },
      ]
    },
    {
      id: 'business',
      label: 'Business Setup',
      items: [
        { id: 'services', label: 'Services', icon: Briefcase, permissions: ['view_services'] },
        { id: 'products', label: 'Add-On Products', icon: Package, permissions: ['view_services', 'manage_services'] },
        { id: 'specialists', label: 'Specialists', icon: UserCircle, permissions: ['view_staff'] },
        { id: 'staff', label: 'Team & Permissions', icon: Users, permissions: ['view_staff', 'manage_staff'] },
      ]
    },
    {
      id: 'financial',
      label: 'Financial',
      items: [
        { id: 'loyalty', label: 'Loyalty & Rewards', icon: Gift, permissions: ['process_payments', 'view_gift_cards'] },
        { id: 'fees', label: 'No-Show Fees', icon: DollarSign, permissions: ['process_payments', 'view_all_bookings'] },
      ]
    },
    {
      id: 'configuration',
      label: 'Configuration',
      items: [
        { id: 'customize', label: 'Form Customization', icon: Palette, permissions: ['manage_settings'] },
        { id: 'settings', label: 'Settings', icon: Settings, permissions: ['view_settings'] },
      ]
    }
  ];

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-[#008374] text-white flex flex-col">
        <div className="p-6 border-b border-white border-opacity-10">
          {logoUrl ? (
            <div className="flex items-center justify-center mb-3">
              <img
                src={logoUrl}
                alt="Business Logo"
                className="h-12 w-auto object-contain"
              />
            </div>
          ) : (
            <h1 className="text-xl font-semibold tracking-wide text-center mb-3">Admin Panel</h1>
          )}
          <p className="text-white text-opacity-70 text-sm text-center">{adminUser?.full_name}</p>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-3">
            {allMenuGroups.map((group) => {
              const visibleItems = group.items.filter(item => {
                if (loading) return true;
                return hasAnyPermission(item.permissions);
              });

              if (visibleItems.length === 0) return null;

              const isExpanded = expandedGroups.includes(group.id);

              return (
                <li key={group.id}>
                  {group.label ? (
                    <>
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className="w-full flex items-center justify-between px-3 py-2 text-white text-opacity-70 hover:text-white transition-colors text-xs font-semibold uppercase tracking-wider"
                      >
                        <span>{group.label}</span>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      {isExpanded && (
                        <ul className="mt-1 space-y-1">
                          {visibleItems.map((item) => {
                            const Icon = item.icon;
                            return (
                              <li key={item.id}>
                                <button
                                  onClick={() => onViewChange(item.id)}
                                  className={`w-full flex items-center space-x-3 px-4 py-2.5 transition-colors ${
                                    currentView === item.id
                                      ? 'bg-[#89BA16] text-white'
                                      : 'text-white text-opacity-80 hover:bg-white hover:bg-opacity-10 hover:text-white'
                                  }`}
                                >
                                  <Icon className="w-4 h-4" />
                                  <span className="text-sm">{item.label}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </>
                  ) : (
                    <ul className="space-y-1">
                      {visibleItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <li key={item.id}>
                            <button
                              onClick={() => onViewChange(item.id)}
                              className={`w-full flex items-center space-x-3 px-4 py-3 transition-colors ${
                                currentView === item.id
                                  ? 'bg-[#89BA16] text-white'
                                  : 'text-white text-opacity-80 hover:bg-white hover:bg-opacity-10 hover:text-white'
                              }`}
                            >
                              <Icon className="w-5 h-5" />
                              <span className="text-sm">{item.label}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-white border-opacity-10 space-y-2">
          <a
            href="https://onbuuk.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center space-x-3 px-4 py-2 text-white text-opacity-70 hover:bg-white hover:bg-opacity-10 hover:text-white transition-colors text-sm"
          >
            <Book className="w-4 h-4" />
            <span>Documentation</span>
            <ExternalLink className="w-3 h-3 ml-auto" />
          </a>

          <a
            href="https://onbuuk.com/support"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center space-x-3 px-4 py-2 text-white text-opacity-70 hover:bg-white hover:bg-opacity-10 hover:text-white transition-colors text-sm"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Get Help</span>
            <ExternalLink className="w-3 h-3 ml-auto" />
          </a>

          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-4 py-2 text-white text-opacity-70 hover:bg-white hover:bg-opacity-10 hover:text-white transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>

          <div className="pt-4 mt-4 border-t border-white border-opacity-10">
            <a
              href="https://onbuuk.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center space-x-2 text-white text-opacity-50 hover:text-white hover:text-opacity-70 transition-colors text-xs"
            >
              <span>Powered by</span>
              <span className="font-semibold">Buuk</span>
              <span>v1.0.0</span>
            </a>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-white">
        <ProfileCompletionBanner onSetupClick={() => onViewChange('settings')} />
        <div className="max-w-7xl mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
