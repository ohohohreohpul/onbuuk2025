import { useState } from 'react';
import { Building, CreditCard, Crown, Store, Layout, Sparkles, Mail, Palette, Gift, User, Code, FileUp, Receipt } from 'lucide-react';
import StoreProfile from './settings/StoreProfile';
import GeneralSettings from './settings/GeneralSettings';
import BookingFormAppearance from './settings/BookingFormAppearance';
import WelcomeFeaturesSettings from './settings/WelcomeFeaturesSettings';
import ColorCustomization from './settings/ColorCustomization';
import PaymentSettings from './settings/PaymentSettings';
import SubscriptionManagement from './settings/SubscriptionManagement';
import CustomerEmails from './settings/CustomerEmails';
import { GiftCardCustomization } from './settings/GiftCardCustomization';
import AccountSettings from './settings/AccountSettings';
import WidgetEmbed from './settings/WidgetEmbed';
import DataImport from './settings/dataImport/DataImport';
import InvoiceSettings from './settings/InvoiceSettings';
import { adminAuth } from '../../lib/adminAuth';
import { useAdminText } from '../../lib/adminLanguage';
import type { Translations } from '../../lib/bookingLanguage';
import {
  ADMIN_SEGMENT_ACTIVE,
  ADMIN_SEGMENT_INACTIVE,
  ADMIN_SEGMENTED_CONTROL,
  ADMIN_SURFACE,
} from './adminUi';

const TEXT: Translations<{
  title: string; subtitle: string; account: string; profile: string; general: string; appearance: string;
  colors: string; welcomeFeatures: string; giftCards: string; widget: string; subscription: string;
  payment: string; emails: string; invoices: string; import: string;
}> = {
  en: {
    title: 'Settings', subtitle: 'Manage your business settings and preferences',
    account: 'Account', profile: 'Store Profile', general: 'General', appearance: 'Booking Form', colors: 'Colors',
    welcomeFeatures: 'Welcome Features', giftCards: 'Gift Cards', widget: 'Widget & Embed', subscription: 'Subscription',
    payment: 'Payment', emails: 'Emails', invoices: 'Invoices', import: 'Import',
  },
  de: {
    title: 'Einstellungen', subtitle: 'Einstellungen und Präferenzen Ihres Unternehmens verwalten',
    account: 'Konto', profile: 'Shop-Profil', general: 'Allgemein', appearance: 'Buchungsformular', colors: 'Farben',
    welcomeFeatures: 'Willkommensfunktionen', giftCards: 'Gutscheine', widget: 'Widget & Einbettung', subscription: 'Abonnement',
    payment: 'Zahlung', emails: 'E-Mails', invoices: 'Rechnungen', import: 'Import',
  },
  th: {
    title: 'การตั้งค่า', subtitle: 'จัดการการตั้งค่าและค่ากำหนดของธุรกิจ',
    account: 'บัญชี', profile: 'ข้อมูลร้าน', general: 'ทั่วไป', appearance: 'แบบฟอร์มการจอง', colors: 'สี',
    welcomeFeatures: 'ฟีเจอร์ต้อนรับ', giftCards: 'บัตรของขวัญ', widget: 'วิดเจ็ตและการฝัง', subscription: 'แพ็กเกจสมาชิก',
    payment: 'การชำระเงิน', emails: 'อีเมล', invoices: 'ใบแจ้งหนี้', import: 'นำเข้าข้อมูล',
  },
};

type SettingsTab = 'profile' | 'general' | 'appearance' | 'welcome-features' | 'colors' | 'payment' | 'subscription' | 'emails' | 'gift-cards' | 'account' | 'widget' | 'import' | 'invoices';

export default function SettingsView() {
  const { t } = useAdminText(TEXT);
  const currentUser = adminAuth.getCurrentUser();
  const isOwner = currentUser?.role === 'owner';
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab') as SettingsTab | null;
    const validTabs: SettingsTab[] = [
      'account', 'profile', 'general', 'appearance', 'welcome-features', 'colors',
      'payment', 'subscription', 'emails', 'gift-cards', 'widget', 'import', 'invoices',
    ];
    if (requestedTab && validTabs.includes(requestedTab)) {
      return requestedTab === 'payment' && !isOwner ? 'account' : requestedTab;
    }
    return 'account';
  });

  const tabs = [
    { id: 'account' as SettingsTab, name: t.account, icon: User },
    { id: 'profile' as SettingsTab, name: t.profile, icon: Store },
    { id: 'general' as SettingsTab, name: t.general, icon: Building },
    { id: 'appearance' as SettingsTab, name: t.appearance, icon: Layout },
    { id: 'colors' as SettingsTab, name: t.colors, icon: Palette },
    { id: 'welcome-features' as SettingsTab, name: t.welcomeFeatures, icon: Sparkles },
    { id: 'gift-cards' as SettingsTab, name: t.giftCards, icon: Gift },
    { id: 'widget' as SettingsTab, name: t.widget, icon: Code },
    { id: 'subscription' as SettingsTab, name: t.subscription, icon: Crown },
    ...(isOwner ? [{ id: 'payment' as SettingsTab, name: t.payment, icon: CreditCard }] : []),
    { id: 'emails' as SettingsTab, name: t.emails, icon: Mail },
    { id: 'invoices' as SettingsTab, name: t.invoices, icon: Receipt },
    { id: 'import' as SettingsTab, name: t.import, icon: FileUp },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#1A1714] mb-2">{t.title}</h1>
        <p className="text-stone-600">{t.subtitle}</p>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className={`${ADMIN_SEGMENTED_CONTROL} min-w-max`}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 rounded-lg px-3.5 py-2.5 text-sm transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? ADMIN_SEGMENT_ACTIVE
                    : ADMIN_SEGMENT_INACTIVE
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium text-sm">{tab.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`${ADMIN_SURFACE} p-6 sm:p-7`}>
        {activeTab === 'account' && <AccountSettings />}
        {activeTab === 'profile' && <StoreProfile />}
        {activeTab === 'general' && <GeneralSettings />}
        {activeTab === 'appearance' && <BookingFormAppearance />}
        {activeTab === 'colors' && <ColorCustomization />}
        {activeTab === 'welcome-features' && <WelcomeFeaturesSettings />}
        {activeTab === 'gift-cards' && <GiftCardCustomization />}
        {activeTab === 'widget' && <WidgetEmbed />}
        {activeTab === 'subscription' && <SubscriptionManagement />}
        {activeTab === 'payment' && <PaymentSettings />}
        {activeTab === 'emails' && <CustomerEmails />}
        {activeTab === 'invoices' && <InvoiceSettings />}
        {activeTab === 'import' && <DataImport />}
      </div>
    </div>
  );
}
