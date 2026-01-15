import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, ToggleLeft, ToggleRight, Info } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';

interface EmailTemplate {
  id: string;
  business_id: string;
  event_key: string;
  name: string;
  subject: string;
  body: string;
  is_enabled: boolean;
  variables: string[];
  created_at: string;
}

const EVENT_KEY_OPTIONS = [
  { value: 'booking_confirmation', label: 'Booking Confirmation', description: 'Sent when a booking is confirmed', variables: ['customer_name', 'customer_email', 'service_name', 'booking_date', 'booking_time', 'specialist_name', 'business_name', 'business_address'] },
  { value: 'booking_reminder', label: 'Booking Reminder', description: 'Sent before appointment', variables: ['customer_name', 'service_name', 'booking_date', 'booking_time', 'business_name'] },
  { value: 'booking_cancelled', label: 'Booking Cancelled', description: 'Sent when booking is cancelled', variables: ['customer_name', 'service_name', 'booking_date', 'business_name'] },
  { value: 'gift_card_purchased', label: 'Gift Card Purchased', description: 'Sent to buyer after purchase', variables: ['customer_name', 'customer_email', 'gift_card_code', 'amount', 'recipient_email', 'business_name'] },
  { value: 'gift_card_received', label: 'Gift Card Received', description: 'Sent to gift card recipient', variables: ['recipient_email', 'gift_card_code', 'amount', 'sender_name', 'message', 'business_name'] },
];

export default function EmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<EmailTemplate> | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);

  useEffect(() => {
    loadBusinessAndTemplates();
  }, []);

  const loadBusinessAndTemplates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: adminData } = await supabase
        .from('admin_users')
        .select('business_id')
        .eq('email', user.email)
        .single();

      if (!adminData) return;

      setBusinessId(adminData.business_id);

      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('business_id', adminData.business_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTemplate({
      name: '',
      event_key: '',
      subject: '',
      body: '',
      is_enabled: true,
      variables: [],
    });
    setIsEditing(true);
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setIsEditing(true);
  };

  const handleToggleEnabled = async (template: EmailTemplate) => {
    try {
      const { error } = await supabase
        .from('email_templates')
        .update({ is_enabled: !template.is_enabled })
        .eq('id', template.id);

      if (error) throw error;
      await loadBusinessAndTemplates();
    } catch (err: any) {
      console.error('Error toggling template:', err);
      alert('Failed to update template: ' + err.message);
    }
  };

  const handleSave = async () => {
    if (!businessId || !editingTemplate) return;

    if (!editingTemplate.name || !editingTemplate.subject || !editingTemplate.body || !editingTemplate.event_key) {
      alert('Please fill in all required fields including Event Type');
      return;
    }

    try {
      if (editingTemplate.id) {
        const { error } = await supabase
          .from('email_templates')
          .update({
            name: editingTemplate.name,
            event_key: editingTemplate.event_key,
            subject: editingTemplate.subject,
            body: editingTemplate.body,
            is_enabled: editingTemplate.is_enabled ?? true,
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;
      } else {
        // Check if template for this event_key already exists
        const { data: existing } = await supabase
          .from('email_templates')
          .select('id')
          .eq('business_id', businessId)
          .eq('event_key', editingTemplate.event_key)
          .maybeSingle();

        if (existing) {
          alert(`A template for "${editingTemplate.event_key}" already exists. Please edit the existing one instead.`);
          return;
        }

        const { error } = await supabase
          .from('email_templates')
          .insert({
            business_id: businessId,
            name: editingTemplate.name,
            event_key: editingTemplate.event_key,
            subject: editingTemplate.subject,
            body: editingTemplate.body,
            is_enabled: editingTemplate.is_enabled ?? true,
          });

        if (error) throw error;
      }

      setIsEditing(false);
      setEditingTemplate(null);
      await loadBusinessAndTemplates();
    } catch (err: any) {
      console.error('Error saving template:', err);
      alert('Failed to save template: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadBusinessAndTemplates();
    } catch (err: any) {
      console.error('Error deleting template:', err);
      alert('Failed to delete template: ' + err.message);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingTemplate(null);
  };

  const getEventKeyInfo = (eventKey: string) => {
    return EVENT_KEY_OPTIONS.find(opt => opt.value === eventKey);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-stone-600">Loading templates...</div>
      </div>
    );
  }

  if (isEditing) {
    const selectedEvent = getEventKeyInfo(editingTemplate?.event_key || '');
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-light text-stone-800">
            {editingTemplate?.id ? 'Edit Template' : 'Create Template'}
          </h2>
          <Button onClick={handleCancel} variant="outline">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="event_key">Event Type *</Label>
            <select
              id="event_key"
              value={editingTemplate?.event_key || ''}
              onChange={(e) =>
                setEditingTemplate({ ...editingTemplate, event_key: e.target.value })
              }
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              disabled={!!editingTemplate?.id}
            >
              <option value="">Select an event type...</option>
              {EVENT_KEY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {selectedEvent && (
              <p className="mt-1 text-sm text-stone-500">{selectedEvent.description}</p>
            )}
          </div>

          <div>
            <Label htmlFor="name">Template Name *</Label>
            <Input
              id="name"
              type="text"
              value={editingTemplate?.name || ''}
              onChange={(e) =>
                setEditingTemplate({ ...editingTemplate, name: e.target.value })
              }
              placeholder="e.g., Booking Confirmation"
            />
          </div>

          <div>
            <Label htmlFor="subject">Email Subject *</Label>
            <Input
              id="subject"
              type="text"
              value={editingTemplate?.subject || ''}
              onChange={(e) =>
                setEditingTemplate({ ...editingTemplate, subject: e.target.value })
              }
              placeholder="e.g., Your booking is confirmed!"
            />
          </div>

          <div>
            <Label htmlFor="body">Email Body (HTML supported) *</Label>
            <textarea
              id="body"
              value={editingTemplate?.body || ''}
              onChange={(e) =>
                setEditingTemplate({ ...editingTemplate, body: e.target.value })
              }
              placeholder="Enter your email content here. You can use HTML for formatting."
              rows={12}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent font-mono text-sm"
            />
          </div>

          {selectedEvent && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">Available Variables</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Use these in your template with double curly braces, e.g., {`{{customer_name}}`}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedEvent.variables.map((v) => (
                      <code key={v} className="px-2 py-1 bg-blue-100 rounded text-xs text-blue-800">
                        {`{{${v}}}`}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editingTemplate?.is_enabled ?? true}
                onChange={(e) =>
                  setEditingTemplate({ ...editingTemplate, is_enabled: e.target.checked })
                }
                className="w-4 h-4 rounded border-stone-300"
              />
              <span className="text-sm text-stone-700">Enable this template</span>
            </label>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={handleSave}
              className="bg-stone-900 hover:bg-stone-800 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Template
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-light text-stone-800 mb-2">Email Templates</h2>
          <p className="text-stone-600">Manage email templates for customer communications</p>
        </div>
        <Button
          onClick={handleCreate}
          className="bg-stone-900 hover:bg-stone-800 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-stone-300 rounded-lg">
          <p className="text-stone-600 mb-4">No email templates yet</p>
          <p className="text-sm text-stone-500 mb-4">Create templates to send automated emails for bookings, gift cards, and more.</p>
          <Button
            onClick={handleCreate}
            variant="outline"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Template
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {templates.map((template) => {
            const eventInfo = getEventKeyInfo(template.event_key);
            return (
              <div
                key={template.id}
                className={`border rounded-lg p-4 transition-colors ${
                  template.is_enabled 
                    ? 'border-stone-200 hover:border-stone-300' 
                    : 'border-stone-200 bg-stone-50 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-medium text-stone-800">{template.name}</h3>
                      {!template.is_enabled && (
                        <span className="px-2 py-0.5 text-xs bg-stone-200 text-stone-600 rounded">
                          Disabled
                        </span>
                      )}
                    </div>
                    {eventInfo && (
                      <p className="text-xs text-stone-500 mt-0.5">
                        Event: {eventInfo.label}
                      </p>
                    )}
                    <p className="text-sm text-stone-600 mt-1">Subject: {template.subject}</p>
                    <div className="mt-2 text-sm text-stone-500 line-clamp-2">
                      {template.body.replace(/<[^>]*>/g, '').substring(0, 150)}...
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => handleToggleEnabled(template)}
                      className={`p-2 rounded transition-colors ${
                        template.is_enabled 
                          ? 'text-green-600 hover:bg-green-50' 
                          : 'text-stone-400 hover:bg-stone-100'
                      }`}
                      title={template.is_enabled ? 'Disable template' : 'Enable template'}
                    >
                      {template.is_enabled ? (
                        <ToggleRight className="w-6 h-6" />
                      ) : (
                        <ToggleLeft className="w-6 h-6" />
                      )}
                    </button>
                    <Button
                      onClick={() => handleEdit(template)}
                      variant="outline"
                      size="sm"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(template.id)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
