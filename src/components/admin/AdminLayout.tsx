import { ReactNode, useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FileText,
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
import {
  BRAND_DOCS_URL,
  BRAND_LOGO,
  BRAND_LOGO_LIGHT,
  BRAND_NAME,
  BRAND_SITE_URL,
  BRAND_SUPPORT_URL,
} from '../../lib/brand';

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
      if (!businessId) {
        setLogoUrl(BRAND_LOGO);
        return;
      }

      const { data } = await supabase
        .from('businesses')
        .select('custom_logo_url, logo_url')
        .eq('id', businessId)
        .maybeSingle();

      setLogoUrl(data?.custom_logo_url || data?.logo_url || BRAND_LOGO);
    }

    fetchLogo();
  }, [businessId]);

  const [expandedGroups, setExpandedGroups] = useState<string[]>(['today', 'customers', 'money', 'business']);

  const allMenuGroups = [
    {
      id: 'main',
      label: null,
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permissions: ['view_reports'] },
      ]
    },
    {
      id: 'today',
      label: 'Today',
      items: [
        { id: 'calendar', label: 'Calendar', icon: Calendar, permissions: ['view_own_calendar', 'view_all_calendars'] },
        { id: 'bookings', label: 'Bookings', icon: Calendar, permissions: ['view_own_bookings', 'view_all_bookings'] },
      ]
    },
    {
      id: 'customers',
      label: 'Customers',
      items: [
        { id: 'customers', label: 'Customers', icon: Users, permissions: ['view_customers'] },
      ]
    },
    {
      id: 'business',
      label: 'Business',
      items: [
        { id: 'services', label: 'Services', icon: Briefcase, permissions: ['view_services'] },
        { id: 'products', label: 'Add-On Products', icon: Package, permissions: ['view_services', 'manage_services'] },
        { id: 'specialists', label: 'Specialists', icon: UserCircle, permissions: ['view_staff'] },
        { id: 'staff', label: 'Team & Permissions', icon: Users, permissions: ['view_staff', 'manage_staff'] },
      ]
    },
    {
      id: 'money',
      label: 'Money',
      items: [
        { id: 'fees', label: 'No-Show Fees', icon: DollarSign, permissions: ['process_payments', 'view_all_bookings'] },
        { id: 'loyalty', label: 'Loyalty & Rewards', icon: Gift, permissions: ['process_payments', 'view_gift_cards'] },
        { id: 'tax', label: 'Tax & Reports', icon: FileText, permissions: ['view_reports', 'process_payments'] },
      ]
    },
    {
      id: 'configuration',
      label: 'Setup',
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
        <div className="h-full bg-gradient-to-b from-[#1A1714] via-[#211D1A] to-[#151210] text-white flex flex-col relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#A09990]/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
          
          {/* Header */}
          <div className="p-6 border-b border-white/10 relative">
            <div className="flex items-center justify-center mb-4">
              <img
                src={
                  !logoUrl ||
                  logoUrl === BRAND_LOGO ||
                  logoUrl === '/defbuuklogo.png' ||
                  logoUrl === '/blbuuklogo.png'
                    ? BRAND_LOGO_LIGHT
                    : logoUrl
                }
                alt={logoUrl && logoUrl !== BRAND_LOGO ? 'Business logo' : BRAND_NAME}
                className="h-10 w-auto object-contain"
              />
            </div>
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
          <nav className="scrollbar-dark flex-1 p-4 overflow-y-auto relative">
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
                                        ? 'bg-white text-[#1A1714] shadow-lg shadow-black/10'
                                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                                    }`}
                                  >
                                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#1A1714]' : ''}`} />
                                    <span className="text-sm font-medium">{item.label}</span>
                                    {isActive && (
                                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#A09990]" />
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
                                    ? 'bg-white text-[#1A1714] shadow-lg shadow-black/10'
                                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <Icon className={`w-5 h-5 ${isActive ? 'text-[#1A1714]' : ''}`} />
                                <span className="text-sm font-medium">{item.label}</span>
                                {isActive && (
                                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#A09990]" />
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
              href={BRAND_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200 text-sm"
            >
              <Book className="w-4 h-4" />
              <span>Documentation</span>
              <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
            </a>

            <a
              href={BRAND_SUPPORT_URL}
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
                href={BRAND_SITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-white/40 hover:text-white/60 transition-colors text-xs"
              >
                <span>Powered by</span>
                <span className="font-semibold">{BRAND_NAME}</span>
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
