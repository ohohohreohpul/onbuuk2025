import { useState } from 'react';
import { Building, CreditCard, Crown, Store, Layout, Sparkles, Mail, Palette, Gift, User, Code } from 'lucide-react';
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
import { adminAuth } from '../../lib/adminAuth';
import {
  ADMIN_SEGMENT_ACTIVE,
  ADMIN_SEGMENT_INACTIVE,
  ADMIN_SEGMENTED_CONTROL,
  ADMIN_SURFACE,
} from './adminUi';

type SettingsTab = 'profile' | 'general' | 'appearance' | 'welcome-features' | 'colors' | 'payment' | 'subscription' | 'emails' | 'gift-cards' | 'account' | 'widget';

export default function SettingsView() {
  const currentUser = adminAuth.getCurrentUser();
  const isOwner = currentUser?.role === 'owner';
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab') as SettingsTab | null;
    const validTabs: SettingsTab[] = [
      'account', 'profile', 'general', 'appearance', 'welcome-features', 'colors',
      'payment', 'subscription', 'emails', 'gift-cards', 'widget',
    ];
    if (requestedTab && validTabs.includes(requestedTab)) {
      return requestedTab === 'payment' && !isOwner ? 'account' : requestedTab;
    }
    return 'account';
  });

  const tabs = [
    { id: 'account' as SettingsTab, name: 'Account', icon: User },
    { id: 'profile' as SettingsTab, name: 'Store Profile', icon: Store },
    { id: 'general' as SettingsTab, name: 'General', icon: Building },
    { id: 'appearance' as SettingsTab, name: 'Booking Form', icon: Layout },
    { id: 'colors' as SettingsTab, name: 'Colors', icon: Palette },
    { id: 'welcome-features' as SettingsTab, name: 'Welcome Features', icon: Sparkles },
    { id: 'gift-cards' as SettingsTab, name: 'Gift Cards', icon: Gift },
    { id: 'widget' as SettingsTab, name: 'Widget & Embed', icon: Code },
    { id: 'subscription' as SettingsTab, name: 'Subscription', icon: Crown },
    ...(isOwner ? [{ id: 'payment' as SettingsTab, name: 'Payment', icon: CreditCard }] : []),
    { id: 'emails' as SettingsTab, name: 'Emails', icon: Mail },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#1A1714] mb-2">Settings</h1>
        <p className="text-stone-600">Manage your business settings and preferences</p>
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
      </div>
    </div>
  );
}
