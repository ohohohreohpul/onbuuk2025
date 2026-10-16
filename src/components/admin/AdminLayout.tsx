import { ReactNode, useState, useEffect } from 'react';
import {
  FileText,
  Calendar,
  MessagesSquare,
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
  Bot,
  ChevronDown,
  Menu,
  X,
  Languages,
  Mail
} from 'lucide-react';
import { adminAuth } from '../../lib/adminAuth';
import { useTenant } from '../../lib/tenantContext';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import ProfileCompletionBanner from './ProfileCompletionBanner';
import HelpModal from './HelpModal';
import PlanNotice from './billing/PlanNotice';
import { useBilling } from './billing/useBilling';
import { requestSettingsTab } from '../../lib/settingsNavigation';
import { ADMIN_LANGUAGES, AdminLanguage, useAdminLanguage, useAdminText } from '../../lib/adminLanguage';
import { Translations } from '../../lib/bookingLanguage';
import {
  BRAND_DOCS_URL,
  BRAND_LOGO,
  BRAND_LOGO_LIGHT,
  BRAND_NAME,
  BRAND_SITE_URL,
} from '../../lib/brand';

const TEXT: Translations<{
  dashboard: string; pos: string; receptionist: string; today: string; calendar: string; bookings: string; customers: string;
  business: string; services: string; products: string; specialists: string; team: string; agents: string; marketing: string;
  money: string; fees: string; loyalty: string; tax: string; setup: string; settings: string;
  documentation: string; help: string; openMenu: string; closeMenu: string; logout: string; poweredBy: string; language: string; businessLogo: string;
}> = {
  en: {
    dashboard: 'Dashboard', pos: 'POS', receptionist: 'AI receptionist', today: 'Today', calendar: 'Calendar', bookings: 'Bookings', customers: 'Customers',
    business: 'Business', services: 'Services', products: 'Add-On Products', specialists: 'Specialists',
    team: 'Team & Permissions', agents: 'AI booking', marketing: 'Email marketing', money: 'Money', fees: 'No-Show Fees',
    loyalty: 'Vouchers', tax: 'Tax & Reports', setup: 'Setup', settings: 'Settings',
    documentation: 'Documentation', help: 'Get Help', openMenu: 'Open menu', closeMenu: 'Close menu', logout: 'Logout', poweredBy: 'Powered by',
    language: 'Language', businessLogo: 'Business logo',
  },
  de: {
    dashboard: 'Übersicht', pos: 'POS', receptionist: 'KI-Rezeption', today: 'Heute', calendar: 'Kalender', bookings: 'Buchungen', customers: 'Kunden',
    business: 'Geschäft', services: 'Leistungen', products: 'Zusatzprodukte', specialists: 'Therapeut:innen',
    team: 'Team & Berechtigungen', agents: 'KI-Buchung', marketing: 'E-Mail-Marketing', money: 'Finanzen', fees: 'No-Show-Gebühren',
    loyalty: 'Gutscheine', tax: 'Steuer & Berichte', setup: 'Einrichtung', settings: 'Einstellungen',
    documentation: 'Dokumentation', help: 'Hilfe', openMenu: 'Menü öffnen', closeMenu: 'Menü schließen', logout: 'Abmelden', poweredBy: 'Powered by',
    language: 'Sprache', businessLogo: 'Firmenlogo',
  },
  th: {
    dashboard: 'แดชบอร์ด', pos: 'POS', receptionist: 'พนักงานต้อนรับ AI', today: 'วันนี้', calendar: 'ปฏิทิน', bookings: 'การจอง', customers: 'ลูกค้า',
    business: 'ธุรกิจ', services: 'บริการ', products: 'สินค้าเสริม', specialists: 'พนักงานบริการ',
    team: 'ทีมและสิทธิ์การใช้งาน', agents: 'การจองผ่าน AI', marketing: 'อีเมลการตลาด', money: 'การเงิน', fees: 'ค่าธรรมเนียมไม่มาตามนัด',
    loyalty: 'บัตรของขวัญ', tax: 'ภาษีและรายงาน', setup: 'ตั้งค่าระบบ', settings: 'การตั้งค่า',
    documentation: 'คู่มือการใช้งาน', help: 'ขอความช่วยเหลือ', openMenu: 'เปิดเมนู', closeMenu: 'ปิดเมนู', logout: 'ออกจากระบบ', poweredBy: 'Powered by',
    language: 'ภาษา', businessLogo: 'โลโก้ร้าน',
  },
};

interface AdminLayoutProps {
  children: ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
  onLogout: () => void;
}

const FOOTER_TILE = 'flex flex-col gap-2 rounded-xl bg-white/[0.04] px-3 py-2.5 text-white/60 ring-1 ring-white/[0.06] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.09] hover:text-white';
const SHORT_LANGUAGE_LABEL: Record<string, string> = { de: 'DE', en: 'EN', th: 'ไทย' };

export default function AdminLayout({ children, currentView, onViewChange, onLogout }: AdminLayoutProps) {
  const adminUser = adminAuth.getCurrentUser();
  const { businessId } = useTenant();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const { hasAnyPermission, loading } = usePermissions(adminUser?.id || null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useAdminText(TEXT);
  const { language, setLanguage } = useAdminLanguage();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const hasOwnLogo = Boolean(logoUrl) && ![BRAND_LOGO, BRAND_LOGO_LIGHT, '/defbuuklogo.png', '/blbuuklogo.png'].includes(logoUrl!);
  const { overview: billing } = useBilling();

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
        { id: 'pos', label: t.pos, icon: Calendar, permissions: ['view_own_calendar', 'view_all_calendars', 'view_reports'] },
        { id: 'receptionist', label: t.receptionist, icon: MessagesSquare, permissions: ['view_customers', 'view_all_bookings'] },
      ]
    },
    {
      id: 'today',
      label: t.today,
      items: [
        { id: 'bookings', label: t.bookings, icon: Calendar, permissions: ['view_own_bookings', 'view_all_bookings'] },
      ]
    },
    {
      id: 'customers',
      label: t.customers,
      items: [
        { id: 'customers', label: t.customers, icon: Users, permissions: ['view_customers'] },
        { id: 'marketing', label: t.marketing, icon: Mail, permissions: ['view_customers', 'view_settings'] },
      ]
    },
    {
      id: 'business',
      label: t.business,
      items: [
        { id: 'services', label: t.services, icon: Briefcase, permissions: ['view_services'] },
        { id: 'products', label: t.products, icon: Package, permissions: ['view_services', 'manage_services'] },
        { id: 'specialists', label: t.specialists, icon: UserCircle, permissions: ['view_staff'] },
        { id: 'staff', label: t.team, icon: Users, permissions: ['view_staff', 'manage_staff'] },
        { id: 'agents', label: t.agents, icon: Bot, permissions: ['view_settings'] },
      ]
    },
    {
      id: 'money',
      label: t.money,
      items: [
        { id: 'fees', label: t.fees, icon: DollarSign, permissions: ['process_payments', 'view_all_bookings'] },
        { id: 'loyalty', label: t.loyalty, icon: Gift, permissions: ['process_payments', 'view_gift_cards'] },
        { id: 'tax', label: t.tax, icon: FileText, permissions: ['view_reports', 'process_payments'] },
      ]
    },
    {
      id: 'configuration',
      label: t.setup,
      items: [
        { id: 'settings', label: t.settings, icon: Settings, permissions: ['view_settings'] },
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
      {/* Sidebar Backdrop */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-[55]"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen w-72 max-w-[85vw] z-[56] lg:z-auto
        transform transition-transform duration-300 ease-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `} style={{ height: '100dvh' }}>
        <div className="h-full bg-gradient-to-b from-[#1A1714] via-[#211D1A] to-[#151210] text-white flex flex-col relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#A09990]/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
          
          {/* Header */}
          <div className="relative border-b border-white/10 p-4 lg:p-6" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label={t.closeMenu}
              className="absolute right-3 top-3 rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
              style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mb-3 flex items-center justify-center lg:mb-4">
              <img
                src={
                  !logoUrl ||
                  logoUrl === BRAND_LOGO ||
                  logoUrl === '/defbuuklogo.png' ||
                  logoUrl === '/blbuuklogo.png'
                    ? BRAND_LOGO_LIGHT
                    : logoUrl
                }
                alt={logoUrl && logoUrl !== BRAND_LOGO ? t.businessLogo : BRAND_NAME}
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
            <PlanNotice
              overview={billing}
              canUpgrade={adminUser?.role === 'owner' || adminUser?.role === 'admin'}
              onUpgrade={() => { requestSettingsTab('subscription'); onViewChange('settings'); setSidebarOpen(false); }}
            />
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
          <div className="relative space-y-2.5 border-t border-white/10 p-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <div role="radiogroup" aria-label={t.language} className="flex items-center gap-1 rounded-xl bg-white/[0.06] p-1">
              <Languages className="mx-1.5 h-3.5 w-3.5 shrink-0 text-white/40" aria-hidden="true" />
              {ADMIN_LANGUAGES.map((option) => {
                const isActive = language === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    title={option.label}
                    onClick={() => setLanguage(option.value as AdminLanguage)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-semibold tracking-wide transition-all duration-200 ${isActive ? 'bg-white text-[#1A1714] shadow-sm' : 'text-white/55 hover:bg-white/10 hover:text-white'}`}
                  >
                    {SHORT_LANGUAGE_LABEL[option.value] ?? option.value.toUpperCase()}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <a
                href={BRAND_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`group relative ${FOOTER_TILE}`}
              >
                <Book className="h-4 w-4" />
                <span className="truncate text-xs font-medium">{t.documentation}</span>
                <ExternalLink className="absolute right-2.5 top-2.5 h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50" />
              </a>
              <button type="button" onClick={() => setIsHelpOpen(true)} className={`text-left ${FOOTER_TILE}`}>
                <HelpCircle className="h-4 w-4" />
                <span className="truncate text-xs font-medium">{t.help}</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 px-1 pt-1">
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-white/50 transition-colors hover:bg-red-500/15 hover:text-red-200"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{t.logout}</span>
              </button>
              <a
                href={BRAND_SITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                title={`${t.poweredBy} ${BRAND_NAME}`}
                className="flex items-center gap-1.5 text-[11px] text-white/35 transition-colors hover:text-white/60"
              >
                <span className="font-semibold">{BRAND_NAME}</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">v1.0</span>
              </a>
            </div>
          </div>
        </div>
      </aside>

      {isHelpOpen && (
        <HelpModal
          account={{ name: adminUser?.full_name ?? '', email: adminUser?.email ?? '', businessId: businessId ?? adminUser?.business_id ?? null }}
          currentView={currentView}
          onClose={() => setIsHelpOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto min-h-screen min-w-0">
        <header
          className="sticky top-0 z-40 flex items-center gap-3 border-b border-stone-200/70 bg-white/85 px-4 pb-2 backdrop-blur-xl lg:hidden"
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label={t.openMenu}
            className="-ml-1 rounded-xl p-2 text-[#1A1714] hover:bg-stone-900/[0.05]"
          >
            <Menu className="h-6 w-6" />
          </button>
          {hasOwnLogo ? (
            <span className="rounded-lg bg-[#1A1714] px-2.5 py-1">
              <img src={logoUrl!} alt={t.businessLogo} className="h-6 w-auto max-w-[45vw] object-contain" />
            </span>
          ) : (
            <img src={BRAND_LOGO} alt={BRAND_NAME} className="h-6 w-auto" />
          )}
        </header>
        <ProfileCompletionBanner onSetupClick={() => { requestSettingsTab('profile'); onViewChange('settings'); }} />
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
