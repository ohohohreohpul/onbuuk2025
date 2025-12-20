import { useState } from 'react';
import { Settings, FileText, History } from 'lucide-react';
import EmailSettings from './EmailSettings';
import EmailTemplates from './EmailTemplates';
import EmailLogs from './EmailLogs';

type EmailTab = 'settings' | 'templates' | 'logs';

export default function CustomerEmails() {
  const [activeTab, setActiveTab] = useState<EmailTab>('settings');

  const tabs = [
    { id: 'settings' as EmailTab, name: 'Settings', icon: Settings },
    { id: 'templates' as EmailTab, name: 'Templates', icon: FileText },
    { id: 'logs' as EmailTab, name: 'Email Logs', icon: History },
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
        {activeTab === 'settings' && <EmailSettings />}
        {activeTab === 'templates' && <EmailTemplates />}
        {activeTab === 'logs' && <EmailLogs />}
      </div>
    </div>
  );
}
