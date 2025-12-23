import { ReactNode, useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Briefcase,
  UserCircle,
  Settings,
  LogOut,
  HelpCircle,
  Book,
  ExternalLink,
  Gift,
  DollarSign,
  Package,
  ChevronDown,
  ChevronRight,
  Menu,
  X
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-[60] p-2 rounded-xl bg-white/90 backdrop-blur-sm shadow-lg border border-gray-200"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar Backdrop */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-[55]"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen w-72 z-[56]
        transform transition-transform duration-300 ease-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-full bg-gradient-to-b from-[#008374] via-[#007367] to-[#006259] text-white flex flex-col relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#89BA16]/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
          
          {/* Header */}
          <div className="p-6 border-b border-white/10 relative">
            {logoUrl ? (
              <div className="flex items-center justify-center mb-4">
                <img
                  src={logoUrl}
                  alt="Business Logo"
                  className="h-10 w-auto object-contain"
                />
              </div>
            ) : (
              <h1 className="text-xl font-semibold tracking-wide text-center mb-4">Admin Panel</h1>
            )}
            <div className="flex items-center gap-3 p-3 bg-white/10 rounded-xl backdrop-blur-sm">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold">
                {adminUser?.full_name?.charAt(0) || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-sm">{adminUser?.full_name}</p>
                <p className="text-xs text-white/60 truncate">{adminUser?.role}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 overflow-y-auto relative">
            <ul className="space-y-2">
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
                          className="w-full flex items-center justify-between px-3 py-2.5 text-white/60 hover:text-white transition-colors text-xs font-semibold uppercase tracking-wider"
                        >
                          <span>{group.label}</span>
                          <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </button>
                        <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                          <ul className="mt-1 space-y-1">
                            {visibleItems.map((item) => {
                              const Icon = item.icon;
                              const isActive = currentView === item.id;
                              return (
                                <li key={item.id}>
                                  <button
                                    onClick={() => {
                                      onViewChange(item.id);
                                      setSidebarOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                                      isActive
                                        ? 'bg-white text-[#008374] shadow-lg shadow-black/10'
                                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                                    }`}
                                  >
                                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#008374]' : ''}`} />
                                    <span className="text-sm font-medium">{item.label}</span>
                                    {isActive && (
                                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#89BA16]" />
                                    )}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </>
                    ) : (
                      <ul className="space-y-1">
                        {visibleItems.map((item) => {
                          const Icon = item.icon;
                          const isActive = currentView === item.id;
                          return (
                            <li key={item.id}>
                              <button
                                onClick={() => {
                                  onViewChange(item.id);
                                  setSidebarOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                                  isActive
                                    ? 'bg-white text-[#008374] shadow-lg shadow-black/10'
                                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <Icon className={`w-5 h-5 ${isActive ? 'text-[#008374]' : ''}`} />
                                <span className="text-sm font-medium">{item.label}</span>
                                {isActive && (
                                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#89BA16]" />
                                )}
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

          {/* Footer */}
          <div className="p-4 border-t border-white/10 space-y-1 relative">
            <a
              href="https://onbuuk.com/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200 text-sm"
            >
              <Book className="w-4 h-4" />
              <span>Documentation</span>
              <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
            </a>

            <a
              href="https://onbuuk.com/support"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200 text-sm"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Get Help</span>
              <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
            </a>

            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-white/60 hover:bg-red-500/20 hover:text-red-200 transition-all duration-200 text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>

            <div className="pt-4 mt-4 border-t border-white/10">
              <a
                href="https://onbuuk.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-white/40 hover:text-white/60 transition-colors text-xs"
              >
                <span>Powered by</span>
                <span className="font-semibold">Buuk</span>
                <span className="px-1.5 py-0.5 bg-white/10 rounded text-[10px]">v1.0</span>
              </a>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto min-h-screen">
        <ProfileCompletionBanner onSetupClick={() => onViewChange('settings')} />
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
