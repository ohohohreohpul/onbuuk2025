import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Save, Mail, MessageSquare, AlertCircle, Eye } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';
import { useCurrency } from '../../../lib/currencyContext';

interface NotificationTemplate {
  id?: string;
  type: string;
  channel: 'email' | 'sms';
  enabled: boolean;
  subject?: string;
  body: string;
  variables: string[];
}

const TEMPLATE_TYPES = [
  {
    type: 'booking_confirmation',
    name: 'Booking Confirmation',
    description: 'Sent when a customer completes a booking',
    variables: ['customerName', 'serviceName', 'specialistName', 'bookingDate', 'startTime', 'duration', 'price', 'bookingId'],
  },
  {
    type: 'booking_reminder',
    name: 'Booking Reminder',
    description: 'Sent 24 hours before appointment',
    variables: ['customerName', 'serviceName', 'specialistName', 'bookingDate', 'startTime'],
  },
  {
    type: 'booking_cancelled',
    name: 'Booking Cancelled',
    description: 'Sent when a booking is cancelled',
    variables: ['customerName', 'serviceName', 'bookingDate', 'startTime'],
  },
  {
    type: 'status_change',
    name: 'Status Change',
    description: 'Sent when booking status changes',
    variables: ['customerName', 'status', 'serviceName', 'bookingDate', 'startTime'],
  },
];

export default function NotificationTemplates() {
  const { businessId } = useTenant();
  const { formatAmount } = useCurrency();
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [selectedType, setSelectedType] = useState('booking_confirmation');
  const [selectedChannel, setSelectedChannel] = useState<'email' | 'sms'>('email');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, [businessId]);

  const fetchTemplates = async () => {
    if (!businessId) return;

    const { data } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('business_id', businessId);

    if (data) {
      setTemplates(data);
    } else {
      initializeDefaultTemplates();
    }
    setLoading(false);
  };

  const initializeDefaultTemplates = () => {
    const defaultTemplates: NotificationTemplate[] = [];

    TEMPLATE_TYPES.forEach((templateType) => {
      defaultTemplates.push({
        type: templateType.type,
        channel: 'email',
        enabled: true,
        subject: `${templateType.name}`,
        body: `Hi {{customerName}},\n\n${templateType.description}.\n\nThank you!`,
        variables: templateType.variables,
      });

      defaultTemplates.push({
        type: templateType.type,
        channel: 'sms',
        enabled: false,
        body: `Hi {{customerName}}, ${templateType.description.toLowerCase()}.`,
        variables: templateType.variables,
      });
    });

    setTemplates(defaultTemplates);
  };

  const getCurrentTemplate = (): NotificationTemplate | undefined => {
    return templates.find((t) => t.type === selectedType && t.channel === selectedChannel);
  };

  const updateCurrentTemplate = (updates: Partial<NotificationTemplate>) => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.type === selectedType && t.channel === selectedChannel
          ? { ...t, ...updates }
          : t
      )
    );
  };

  const handleSave = async () => {
    if (!businessId) return;

    setSaving(true);
    setSavedMessage('');

    try {
      for (const template of templates) {
        const payload = {
          business_id: businessId,
          type: template.type,
          channel: template.channel,
          enabled: template.enabled,
          subject: template.subject,
          body: template.body,
          variables: template.variables,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('notification_templates')
          .upsert(payload, {
            onConflict: 'business_id,type,channel',
          });

        if (error) throw error;
      }

      setSavedMessage('Templates saved successfully!');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Error saving templates:', error);
      alert('Failed to save templates');
    } finally {
      setSaving(false);
    }
  };

  const renderPreview = () => {
    const template = getCurrentTemplate();
    if (!template) return null;

    const sampleData: { [key: string]: string } = {
      customerName: 'John Doe',
      serviceName: 'Swedish Massage',
      specialistName: 'Jane Smith',
      bookingDate: 'Monday, January 15, 2024',
      startTime: '2:00 PM',
      duration: '60 minutes',
      price: formatAmount(89),
      bookingId: 'BK-12345',
      status: 'confirmed',
    };

    let previewBody = template.body;
    Object.entries(sampleData).forEach(([key, value]) => {
      previewBody = previewBody.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div className="p-6 border-b border-stone-200 flex items-center justify-between">
            <h3 className="text-lg font-medium text-stone-800">Preview</h3>
            <button onClick={() => setShowPreview(false)} className="text-stone-400 hover:text-stone-600">
              ×
            </button>
          </div>
          <div className="p-6 overflow-y-auto">
            {template.channel === 'email' && (
              <div className="mb-4">
                <p className="text-sm text-stone-600 mb-1">Subject:</p>
                <p className="font-medium">{template.subject}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-stone-600 mb-1">Message:</p>
              <div className="whitespace-pre-wrap p-4 bg-stone-50 border border-stone-200 rounded">
                {previewBody}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="text-stone-600">Loading...</div>;
  }

  const currentTemplate = getCurrentTemplate();
  const currentTemplateType = TEMPLATE_TYPES.find((t) => t.type === selectedType);

  return (
    <div className="space-y-6">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded">
        <p className="text-sm text-blue-800">
          Customize notification messages sent to customers. Use variables like{' '}
          <code className="bg-blue-100 px-1 rounded">{'{{customerName}}'}</code> to personalize messages.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Template Type
          </label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
          >
            {TEMPLATE_TYPES.map((template) => (
              <option key={template.type} value={template.type}>
                {template.name}
              </option>
            ))}
          </select>
          {currentTemplateType && (
            <p className="text-xs text-stone-500 mt-1">{currentTemplateType.description}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Channel
          </label>
          <div className="flex space-x-2">
            <button
              onClick={() => setSelectedChannel('email')}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 border rounded transition-colors ${
                selectedChannel === 'email'
                  ? 'border-stone-800 bg-stone-50'
                  : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>Email</span>
            </button>
            <button
              onClick={() => setSelectedChannel('sms')}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 border rounded transition-colors ${
                selectedChannel === 'sms'
                  ? 'border-stone-800 bg-stone-50'
                  : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>SMS</span>
            </button>
          </div>
        </div>
      </div>

      {currentTemplate && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={currentTemplate.enabled}
                onChange={(e) => updateCurrentTemplate({ enabled: e.target.checked })}
                className="w-5 h-5 rounded border-stone-300"
              />
              <span className="text-sm font-medium text-stone-700">Enable this notification</span>
            </label>
          </div>

          {selectedChannel === 'email' && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Subject Line
              </label>
              <input
                type="text"
                value={currentTemplate.subject || ''}
                onChange={(e) => updateCurrentTemplate({ subject: e.target.value })}
                className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Message Body
            </label>
            <textarea
              value={currentTemplate.body}
              onChange={(e) => updateCurrentTemplate({ body: e.target.value })}
              rows={selectedChannel === 'email' ? 12 : 6}
              className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800 resize-none font-mono text-sm"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-stone-700 mb-2">Available Variables:</p>
            <div className="flex flex-wrap gap-2">
              {currentTemplateType?.variables.map((variable) => (
                <code
                  key={variable}
                  className="px-2 py-1 bg-stone-100 text-stone-800 rounded text-xs cursor-pointer hover:bg-stone-200"
                  onClick={() => {
                    updateCurrentTemplate({
                      body: currentTemplate.body + `{{${variable}}}`,
                    });
                  }}
                >
                  {'{{' + variable + '}}'}
                </code>
              ))}
            </div>
            <p className="text-xs text-stone-500 mt-1">Click a variable to insert it into the message</p>
          </div>

          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center space-x-2 px-4 py-2 border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span>Preview</span>
          </button>
        </div>
      )}

      {savedMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-800">{savedMessage}</span>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center space-x-2 px-6 py-3 bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          <span>{saving ? 'Saving...' : 'Save All Templates'}</span>
        </button>
      </div>

      {showPreview && renderPreview()}
    </div>
  );
}
