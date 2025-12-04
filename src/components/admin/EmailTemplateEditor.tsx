import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Save, Send, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface EmailTemplate {
  id: string;
  event_key: string;
  template_name: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  is_default: boolean;
  preview_data: Record<string, any>;
}

interface EmailEvent {
  event_key: string;
  event_name: string;
  event_description: string;
  available_variables: string[];
}

interface EmailTemplateEditorProps {
  eventKey: string;
  onClose: () => void;
}

export default function EmailTemplateEditor({ eventKey, onClose }: EmailTemplateEditorProps) {
  const [event, setEvent] = useState<EmailEvent | null>(null);
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [eventKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [eventRes, templateRes] = await Promise.all([
        supabase.from('platform_email_events').select('*').eq('event_key', eventKey).single(),
        supabase.from('platform_email_templates').select('*').eq('event_key', eventKey).eq('is_default', true).maybeSingle(),
      ]);

      if (eventRes.error) throw eventRes.error;
      setEvent(eventRes.data);

      if (templateRes.data) {
        setTemplate(templateRes.data);
      }
    } catch (err) {
      console.error('Error loading template:', err);
      showMessage('error', 'Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = async () => {
    if (!template || !event) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('platform_email_templates')
        .upsert({
          ...template,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      showMessage('success', 'Template saved successfully');
    } catch (err) {
      console.error('Error saving template:', err);
      showMessage('error', 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail || !template || !event) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-platform-email', {
        body: {
          event_key: eventKey,
          recipient_email: testEmail,
          variables: template.preview_data,
        },
      });

      if (error) throw error;
      showMessage('success', `Test email sent to ${testEmail}`);
      setTestEmail('');
    } catch (err) {
      console.error('Error sending test email:', err);
      showMessage('error', 'Failed to send test email');
    } finally {
      setSending(false);
    }
  };

  const insertVariable = (variable: string) => {
    if (!template) return;
    const cursorPosition = (document.activeElement as HTMLTextAreaElement)?.selectionStart || template.html_body.length;
    const before = template.html_body.substring(0, cursorPosition);
    const after = template.html_body.substring(cursorPosition);
    setTemplate({
      ...template,
      html_body: `${before}{{${variable}}}${after}`,
    });
  };

  const renderPreview = () => {
    if (!template) return '';
    let html = template.html_body;
    for (const [key, value] of Object.entries(template.preview_data)) {
      html = html.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return html;
  };

  if (loading) {
    return <div className="text-center py-8">Loading template editor...</div>;
  }

  if (!event || !template) {
    return (
      <div className="bg-white shadow p-6">
        <button onClick={onClose} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4">
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <div className="text-center py-8 text-red-600">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" />
          <p>Template not found. Please create a default template first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{event.event_name}</h2>
              <p className="text-sm text-gray-600">{event.event_description}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>

        {message && (
          <div className={`px-6 py-3 ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message.text}
          </div>
        )}

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Available Variables</label>
            <div className="flex flex-wrap gap-2">
              {event.available_variables.map((variable) => (
                <button
                  key={variable}
                  onClick={() => insertVariable(variable)}
                  className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors"
                  title={`Click to insert {{${variable}}}`}
                >
                  {variable}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Name</label>
              <input
                type="text"
                value={template.from_name}
                onChange={(e) => setTemplate({ ...template, from_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Email</label>
              <input
                type="email"
                value={template.from_email}
                onChange={(e) => setTemplate({ ...template, from_email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject Line</label>
            <input
              type="text"
              value={template.subject}
              onChange={(e) => setTemplate({ ...template, subject: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              placeholder="Use {{variable}} for dynamic content"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">HTML Body</label>
            <textarea
              value={template.html_body}
              onChange={(e) => setTemplate({ ...template, html_body: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-slate-500 focus:border-transparent font-mono text-sm"
              rows={20}
              placeholder="HTML email template with {{variables}}"
            />
          </div>

          {showPreview && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Preview</label>
              <div className="border border-gray-300 p-4 bg-white">
                <div className="mb-4 pb-4 border-b">
                  <p className="text-sm text-gray-600">Subject:</p>
                  <p className="font-semibold">{template.subject.replace(/{{(\w+)}}/g, (_, key) => template.preview_data[key] || '')}</p>
                </div>
                <iframe
                  srcDoc={renderPreview()}
                  className="w-full border-0"
                  style={{ minHeight: '400px' }}
                  title="Email Preview"
                />
              </div>
            </div>
          )}

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Send Test Email</h3>
            <div className="flex gap-3">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Enter email address"
                className="flex-1 px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
              <button
                onClick={handleSendTest}
                disabled={!testEmail || sending}
                className="flex items-center gap-2 px-6 py-2 bg-slate-700 text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Sending...' : 'Send Test'}
              </button>
            </div>
            <p className="text-sm text-gray-600 mt-2">Test email will use preview data for variables</p>
          </div>
        </div>
      </div>
    </div>
  );
}
