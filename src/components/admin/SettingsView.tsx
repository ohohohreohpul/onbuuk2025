import { useState } from 'react';
import { Building, CreditCard, Crown, Store, Layout, Globe, Sparkles, Mail } from 'lucide-react';
import StoreProfile from './settings/StoreProfile';
import GeneralSettings from './settings/GeneralSettings';
import BookingFormAppearance from './settings/BookingFormAppearance';
import WelcomeFeaturesSettings from './settings/WelcomeFeaturesSettings';
import PaymentSettings from './settings/PaymentSettings';
import SubscriptionManagement from './settings/SubscriptionManagement';
import CustomDomainSettings from './settings/CustomDomainSettings';
import CustomerEmails from './settings/CustomerEmails';

type SettingsTab = 'profile' | 'general' | 'appearance' | 'welcome-features' | 'payment' | 'subscription' | 'domains' | 'emails';

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  const tabs = [
    { id: 'profile' as SettingsTab, name: 'Store Profile', icon: Store },
    { id: 'general' as SettingsTab, name: 'General', icon: Building },
    { id: 'domains' as SettingsTab, name: 'Custom Domains', icon: Globe },
    { id: 'appearance' as SettingsTab, name: 'Booking Form', icon: Layout },
    { id: 'welcome-features' as SettingsTab, name: 'Welcome Features', icon: Sparkles },
    { id: 'subscription' as SettingsTab, name: 'Subscription', icon: Crown },
    { id: 'payment' as SettingsTab, name: 'Payment', icon: CreditCard },
    { id: 'emails' as SettingsTab, name: 'Emails', icon: Mail },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-light text-stone-800 mb-2">Settings</h1>
        <p className="text-stone-600">Manage your business settings and preferences</p>
      </div>

      <div className="border-b border-stone-200 overflow-x-auto">
        <div className="flex space-x-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-stone-800 text-stone-900'
                    : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium text-sm">{tab.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-stone-200 p-6">
        {activeTab === 'profile' && <StoreProfile />}
        {activeTab === 'general' && <GeneralSettings />}
        {activeTab === 'domains' && <CustomDomainSettings />}
        {activeTab === 'appearance' && <BookingFormAppearance />}
        {activeTab === 'welcome-features' && <WelcomeFeaturesSettings />}
        {activeTab === 'subscription' && <SubscriptionManagement />}
        {activeTab === 'payment' && <PaymentSettings />}
        {activeTab === 'emails' && <CustomerEmails />}
      </div>
    </div>
  );
}
