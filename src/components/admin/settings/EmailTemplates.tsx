import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, ToggleLeft, ToggleRight, Info } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText, type Translations } from '../../../lib/bookingLanguage';

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
  { value: 'booking_confirmation', variables: ['customer_name', 'customer_email', 'service_name', 'booking_date', 'booking_time', 'specialist_name', 'business_name', 'business_address'] },
  { value: 'booking_reminder', variables: ['customer_name', 'service_name', 'booking_date', 'booking_time', 'business_name'] },
  { value: 'booking_cancelled', variables: ['customer_name', 'service_name', 'booking_date', 'business_name'] },
  { value: 'gift_card_purchased', variables: ['customer_name', 'customer_email', 'gift_card_code', 'amount', 'recipient_email', 'business_name'] },
  { value: 'gift_card_received', variables: ['recipient_email', 'gift_card_code', 'amount', 'sender_name', 'message', 'business_name'] },
];

type EventTextKey =
  | 'event_booking_confirmation' | 'event_booking_confirmation_desc' | 'event_booking_reminder' | 'event_booking_reminder_desc'
  | 'event_booking_cancelled' | 'event_booking_cancelled_desc' | 'event_gift_card_purchased' | 'event_gift_card_purchased_desc'
  | 'event_gift_card_received' | 'event_gift_card_received_desc';

const TEXT: Translations<Record<EventTextKey, string> & {
  updateFailed: string; fillRequired: string; alreadyExists: string; saveFailed: string; confirmDelete: string;
  deleteFailed: string; loading: string; editTemplate: string; createTemplate: string; cancel: string; eventType: string;
  selectEvent: string; templateName: string; namePlaceholder: string; subject: string; subjectPlaceholder: string;
  body: string; bodyPlaceholder: string; variables: string; variablesHint: string; enableTemplate: string;
  saveTemplate: string; title: string; subtitle: string; newTemplate: string; empty: string; emptyHint: string;
  createFirst: string; disabled: string; eventLine: string; subjectLine: string; disableTemplate: string;
  enableTemplateTitle: string; edit: string; delete: string;
}> = {
  en: {
    event_booking_confirmation: 'Booking Confirmation', event_booking_confirmation_desc: 'Sent when a booking is confirmed',
    event_booking_reminder: 'Booking Reminder', event_booking_reminder_desc: 'Sent before appointment',
    event_booking_cancelled: 'Booking Cancelled', event_booking_cancelled_desc: 'Sent when booking is cancelled',
    event_gift_card_purchased: 'Gift Card Purchased', event_gift_card_purchased_desc: 'Sent to buyer after purchase',
    event_gift_card_received: 'Gift Card Received', event_gift_card_received_desc: 'Sent to gift card recipient',
    updateFailed: 'Failed to update template: {reason}', fillRequired: 'Please fill in all required fields including Event Type',
    alreadyExists: 'A template for "{event}" already exists. Please edit the existing one instead.',
    saveFailed: 'Failed to save template: {reason}', confirmDelete: 'Are you sure you want to delete this template?',
    deleteFailed: 'Failed to delete template: {reason}', loading: 'Loading templates...', editTemplate: 'Edit Template',
    createTemplate: 'Create Template', cancel: 'Cancel', eventType: 'Event Type', selectEvent: 'Select an event type...',
    templateName: 'Template Name', namePlaceholder: 'e.g., Booking Confirmation', subject: 'Email Subject',
    subjectPlaceholder: 'e.g., Your booking is confirmed!', body: 'Email Body (HTML supported)',
    bodyPlaceholder: 'Enter your email content here. You can use HTML for formatting.', variables: 'Available Variables',
    variablesHint: 'Use these in your template with double curly braces, e.g.,', enableTemplate: 'Enable this template',
    saveTemplate: 'Save Template', title: 'Email Templates', subtitle: 'Manage email templates for customer communications',
    newTemplate: 'New Template', empty: 'No email templates yet',
    emptyHint: 'Create templates to send automated emails for bookings, gift cards, and more.',
    createFirst: 'Create Your First Template', disabled: 'Disabled', eventLine: 'Event: {event}', subjectLine: 'Subject: {subject}',
    disableTemplate: 'Disable template', enableTemplateTitle: 'Enable template', edit: 'Edit', delete: 'Delete',
  },
  de: {
    event_booking_confirmation: 'Buchungsbestätigung', event_booking_confirmation_desc: 'Wird gesendet, wenn eine Buchung bestätigt ist',
    event_booking_reminder: 'Terminerinnerung', event_booking_reminder_desc: 'Wird vor dem Termin gesendet',
    event_booking_cancelled: 'Buchung storniert', event_booking_cancelled_desc: 'Wird gesendet, wenn eine Buchung storniert wird',
    event_gift_card_purchased: 'Gutschein gekauft', event_gift_card_purchased_desc: 'Wird nach dem Kauf an den Käufer gesendet',
    event_gift_card_received: 'Gutschein erhalten', event_gift_card_received_desc: 'Wird an den Empfänger des Gutscheins gesendet',
    updateFailed: 'Vorlage konnte nicht aktualisiert werden: {reason}', fillRequired: 'Bitte alle Pflichtfelder einschließlich Ereignis ausfüllen',
    alreadyExists: 'Für „{event}“ gibt es bereits eine Vorlage. Bitte die vorhandene bearbeiten.',
    saveFailed: 'Vorlage konnte nicht gespeichert werden: {reason}', confirmDelete: 'Diese Vorlage wirklich löschen?',
    deleteFailed: 'Vorlage konnte nicht gelöscht werden: {reason}', loading: 'Vorlagen werden geladen...', editTemplate: 'Vorlage bearbeiten',
    createTemplate: 'Vorlage erstellen', cancel: 'Abbrechen', eventType: 'Ereignis', selectEvent: 'Ereignis auswählen...',
    templateName: 'Name der Vorlage', namePlaceholder: 'z. B. Buchungsbestätigung', subject: 'E-Mail-Betreff',
    subjectPlaceholder: 'z. B. Ihre Buchung ist bestätigt!', body: 'E-Mail-Text (HTML möglich)',
    bodyPlaceholder: 'E-Mail-Inhalt hier eingeben. HTML kann zur Formatierung verwendet werden.', variables: 'Verfügbare Variablen',
    variablesHint: 'In der Vorlage mit doppelten geschweiften Klammern verwenden, z. B.', enableTemplate: 'Diese Vorlage aktivieren',
    saveTemplate: 'Vorlage speichern', title: 'E-Mail-Vorlagen', subtitle: 'E-Mail-Vorlagen für die Kundenkommunikation verwalten',
    newTemplate: 'Neue Vorlage', empty: 'Noch keine E-Mail-Vorlagen',
    emptyHint: 'Vorlagen erstellen, um automatische E-Mails zu Buchungen, Gutscheinen und mehr zu senden.',
    createFirst: 'Erste Vorlage erstellen', disabled: 'Deaktiviert', eventLine: 'Ereignis: {event}', subjectLine: 'Betreff: {subject}',
    disableTemplate: 'Vorlage deaktivieren', enableTemplateTitle: 'Vorlage aktivieren', edit: 'Bearbeiten', delete: 'Löschen',
  },
  th: {
    event_booking_confirmation: 'ยืนยันการจอง', event_booking_confirmation_desc: 'ส่งเมื่อการจองได้รับการยืนยัน',
    event_booking_reminder: 'แจ้งเตือนนัดหมาย', event_booking_reminder_desc: 'ส่งก่อนถึงเวลานัด',
    event_booking_cancelled: 'ยกเลิกการจอง', event_booking_cancelled_desc: 'ส่งเมื่อการจองถูกยกเลิก',
    event_gift_card_purchased: 'ซื้อบัตรของขวัญ', event_gift_card_purchased_desc: 'ส่งถึงผู้ซื้อหลังซื้อเสร็จ',
    event_gift_card_received: 'ได้รับบัตรของขวัญ', event_gift_card_received_desc: 'ส่งถึงผู้รับบัตรของขวัญ',
    updateFailed: 'อัปเดตเทมเพลตไม่สำเร็จ: {reason}', fillRequired: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบ รวมถึงประเภทเหตุการณ์',
    alreadyExists: 'มีเทมเพลตสำหรับ "{event}" อยู่แล้ว กรุณาแก้ไขเทมเพลตเดิมแทน',
    saveFailed: 'บันทึกเทมเพลตไม่สำเร็จ: {reason}', confirmDelete: 'ต้องการลบเทมเพลตนี้ใช่ไหม',
    deleteFailed: 'ลบเทมเพลตไม่สำเร็จ: {reason}', loading: 'กำลังโหลดเทมเพลต...', editTemplate: 'แก้ไขเทมเพลต',
    createTemplate: 'สร้างเทมเพลต', cancel: 'ยกเลิก', eventType: 'ประเภทเหตุการณ์', selectEvent: 'เลือกประเภทเหตุการณ์...',
    templateName: 'ชื่อเทมเพลต', namePlaceholder: 'เช่น ยืนยันการจอง', subject: 'หัวเรื่องอีเมล',
    subjectPlaceholder: 'เช่น การจองของคุณได้รับการยืนยันแล้ว!', body: 'เนื้อหาอีเมล (รองรับ HTML)',
    bodyPlaceholder: 'ใส่เนื้อหาอีเมลที่นี่ ใช้ HTML จัดรูปแบบได้', variables: 'ตัวแปรที่ใช้ได้',
    variablesHint: 'ใช้ในเทมเพลตโดยใส่วงเล็บปีกกาสองชั้น เช่น', enableTemplate: 'เปิดใช้เทมเพลตนี้',
    saveTemplate: 'บันทึกเทมเพลต', title: 'เทมเพลตอีเมล', subtitle: 'จัดการเทมเพลตอีเมลสำหรับติดต่อลูกค้า',
    newTemplate: 'เทมเพลตใหม่', empty: 'ยังไม่มีเทมเพลตอีเมล',
    emptyHint: 'สร้างเทมเพลตเพื่อส่งอีเมลอัตโนมัติสำหรับการจอง บัตรของขวัญ และอื่น ๆ',
    createFirst: 'สร้างเทมเพลตแรก', disabled: 'ปิดใช้งาน', eventLine: 'เหตุการณ์: {event}', subjectLine: 'หัวเรื่อง: {subject}',
    disableTemplate: 'ปิดใช้เทมเพลต', enableTemplateTitle: 'เปิดใช้เทมเพลต', edit: 'แก้ไข', delete: 'ลบ',
  },
};

export default function EmailTemplates() {
  const { t } = useAdminText(TEXT);
  const eventLabel = (eventKey: string): string => t[`event_${eventKey}` as EventTextKey] ?? eventKey;
  const eventDescription = (eventKey: string): string => t[`event_${eventKey}_desc` as EventTextKey] ?? '';
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
      alert(fillText(t.updateFailed, { reason: err.message }));
    }
  };

  const handleSave = async () => {
    if (!businessId || !editingTemplate) return;

    if (!editingTemplate.name || !editingTemplate.subject || !editingTemplate.body || !editingTemplate.event_key) {
      alert(t.fillRequired);
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
          alert(fillText(t.alreadyExists, { event: eventLabel(editingTemplate.event_key) }));
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
      alert(fillText(t.saveFailed, { reason: err.message }));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;

    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadBusinessAndTemplates();
    } catch (err: any) {
      console.error('Error deleting template:', err);
      alert(fillText(t.deleteFailed, { reason: err.message }));
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
        <div className="text-stone-600">{t.loading}</div>
      </div>
    );
  }

  if (isEditing) {
    const selectedEvent = getEventKeyInfo(editingTemplate?.event_key || '');
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-light text-stone-800">
            {editingTemplate?.id ? t.editTemplate : t.createTemplate}
          </h2>
          <Button onClick={handleCancel} variant="outline">
            <X className="w-4 h-4 mr-2" />
            {t.cancel}
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="event_key">{t.eventType} *</Label>
            <select
              id="event_key"
              value={editingTemplate?.event_key || ''}
              onChange={(e) =>
                setEditingTemplate({ ...editingTemplate, event_key: e.target.value })
              }
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              disabled={!!editingTemplate?.id}
            >
              <option value="">{t.selectEvent}</option>
              {EVENT_KEY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {eventLabel(opt.value)}
                </option>
              ))}
            </select>
            {selectedEvent && (
              <p className="mt-1 text-sm text-stone-500">{eventDescription(selectedEvent.value)}</p>
            )}
          </div>

          <div>
            <Label htmlFor="name">{t.templateName} *</Label>
            <Input
              id="name"
              type="text"
              value={editingTemplate?.name || ''}
              onChange={(e) =>
                setEditingTemplate({ ...editingTemplate, name: e.target.value })
              }
              placeholder={t.namePlaceholder}
            />
          </div>

          <div>
            <Label htmlFor="subject">{t.subject} *</Label>
            <Input
              id="subject"
              type="text"
              value={editingTemplate?.subject || ''}
              onChange={(e) =>
                setEditingTemplate({ ...editingTemplate, subject: e.target.value })
              }
              placeholder={t.subjectPlaceholder}
            />
          </div>

          <div>
            <Label htmlFor="body">{t.body} *</Label>
            <textarea
              id="body"
              value={editingTemplate?.body || ''}
              onChange={(e) =>
                setEditingTemplate({ ...editingTemplate, body: e.target.value })
              }
              placeholder={t.bodyPlaceholder}
              rows={12}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent font-mono text-sm"
            />
          </div>

          {selectedEvent && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">{t.variables}</p>
                  <p className="text-sm text-blue-700 mt-1">
                    {t.variablesHint} {`{{customer_name}}`}
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
              <span className="text-sm text-stone-700">{t.enableTemplate}</span>
            </label>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={handleSave}
              className="bg-stone-900 hover:bg-stone-800 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {t.saveTemplate}
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
          <h2 className="text-2xl font-light text-stone-800 mb-2">{t.title}</h2>
          <p className="text-stone-600">{t.subtitle}</p>
        </div>
        <Button
          onClick={handleCreate}
          className="bg-stone-900 hover:bg-stone-800 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t.newTemplate}
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-stone-300 rounded-lg">
          <p className="text-stone-600 mb-4">{t.empty}</p>
          <p className="text-sm text-stone-500 mb-4">{t.emptyHint}</p>
          <Button
            onClick={handleCreate}
            variant="outline"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t.createFirst}
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
                          {t.disabled}
                        </span>
                      )}
                    </div>
                    {eventInfo && (
                      <p className="text-xs text-stone-500 mt-0.5">
                        {fillText(t.eventLine, { event: eventLabel(eventInfo.value) })}
                      </p>
                    )}
                    <p className="text-sm text-stone-600 mt-1">{fillText(t.subjectLine, { subject: template.subject })}</p>
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
                      title={template.is_enabled ? t.disableTemplate : t.enableTemplateTitle}
                      aria-label={template.is_enabled ? t.disableTemplate : t.enableTemplateTitle}
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
                      title={t.edit}
                      aria-label={t.edit}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(template.id)}
                      variant="outline"
                      size="sm"
                      title={t.delete}
                      aria-label={t.delete}
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
