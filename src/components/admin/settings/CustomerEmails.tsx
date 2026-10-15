import { useState } from 'react';
import { Settings, FileText, History } from 'lucide-react';
import EmailSettings from './EmailSettings';
import BookingNotificationSettings from './BookingNotificationSettings';
import EmailTemplates from './EmailTemplates';
import EmailLogs from './EmailLogs';
import { useAdminText } from '../../../lib/adminLanguage';
import type { Translations } from '../../../lib/bookingLanguage';

const TEXT: Translations<{ settings: string; templates: string; logs: string }> = {
  en: { settings: 'Settings', templates: 'Templates', logs: 'Email Logs' },
  de: { settings: 'Einstellungen', templates: 'Vorlagen', logs: 'E-Mail-Protokoll' },
  th: { settings: 'การตั้งค่า', templates: 'เทมเพลต', logs: 'ประวัติอีเมล' },
};

type EmailTab = 'settings' | 'templates' | 'logs';

export default function CustomerEmails() {
  const { t } = useAdminText(TEXT);
  const [activeTab, setActiveTab] = useState<EmailTab>('settings');

  const tabs = [
    { id: 'settings' as EmailTab, name: t.settings, icon: Settings },
    { id: 'templates' as EmailTab, name: t.templates, icon: FileText },
    { id: 'logs' as EmailTab, name: t.logs, icon: History },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-stone-200">
        <div className="flex space-x-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${
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

      <div>
        {activeTab === 'settings' && (
          <>
            <BookingNotificationSettings />
            <EmailSettings />
          </>
        )}
        {activeTab === 'templates' && <EmailTemplates />}
        {activeTab === 'logs' && <EmailLogs />}
      </div>
    </div>
  );
}
