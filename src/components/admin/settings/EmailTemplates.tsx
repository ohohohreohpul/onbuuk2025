import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';

interface EmailTemplate {
  id: string;
  business_id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  created_at: string;
}

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
      subject: '',
      body: '',
      variables: [],
    });
    setIsEditing(true);
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!businessId || !editingTemplate) return;

    if (!editingTemplate.name || !editingTemplate.subject || !editingTemplate.body) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      if (editingTemplate.id) {
        const { error } = await supabase
          .from('email_templates')
          .update({
            name: editingTemplate.name,
            subject: editingTemplate.subject,
            body: editingTemplate.body,
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_templates')
          .insert({
            business_id: businessId,
            name: editingTemplate.name,
            subject: editingTemplate.subject,
            body: editingTemplate.body,
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-stone-600">Loading templates...</div>
      </div>
    );
  }

  if (isEditing) {
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
            <Label htmlFor="name">Template Name</Label>
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
            <Label htmlFor="subject">Email Subject</Label>
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
            <Label htmlFor="body">Email Body (HTML supported)</Label>
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
            <p className="mt-2 text-sm text-stone-500">
              You can use HTML tags for formatting. Available variables: {'{customer_name}'}, {'{booking_date}'}, {'{service_name}'}
            </p>
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
          <p className="text-stone-600">Create reusable email templates for customer communications</p>
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
          {templates.map((template) => (
            <div
              key={template.id}
              className="border border-stone-200 rounded-lg p-4 hover:border-stone-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-stone-800">{template.name}</h3>
                  <p className="text-sm text-stone-600 mt-1">Subject: {template.subject}</p>
                  <div className="mt-2 text-sm text-stone-500 line-clamp-2">
                    {template.body.replace(/<[^>]*>/g, '')}
                  </div>
                </div>
                <div className="flex gap-2">
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
          ))}
        </div>
      )}
    </div>
  );
}
