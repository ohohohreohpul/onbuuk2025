import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';
import { Plus, Edit2, Trash2, X, LayoutList, LayoutGrid, GripVertical, Upload } from 'lucide-react';
import { usePremiumFeatures } from '../../hooks/usePremiumFeatures';
import { ImportServicesModal } from './ImportServicesModal';
import { useCurrency } from '../../lib/currencyContext';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, type Translations } from '../../lib/bookingLanguage';
import { duplicateMinutes, planDurationChanges, type EditedDuration } from './services/durationChanges';

const TEXT: Translations<{
  title: string; subtitle: string; allCategories: string; listView: string; gridView: string; importTitle: string;
  importButton: string; addService: string; serviceCountOne: string; serviceCountMany: string; uncategorized: string;
  hidden: string; couplesAvailable: string; couples: string; edit: string; delete: string; durationsPricing: string;
  minutesValue: string; noImage: string; editService: string; newService: string; close: string; serviceName: string;
  description: string; category: string; selectCategory: string; createCategory: string; newCategoryPlaceholder: string;
  backToCategories: string; imageUrl: string; stockPhotosBefore: string; stockPhotosOr: string; imagePreview: string;
  availableForCouples: string; hideFromBooking: string; hideFromBookingHint: string; bufferBefore: string;
  bufferBeforeHint: string; bufferAfter: string; bufferAfterHint: string; feesTitle: string; noShowFee: string;
  noShowFeeHint: string; lateCancelFee: string; lateCancelFeeHint: string; cancelBefore: string; cancelBeforeHint: string;
  durationsPrices: string; addDuration: string; durationPlaceholder: string; pricePlaceholder: string; removeDuration: string;
  updateService: string; createService: string; cancel: string; limitReached: string; chooseCategory: string;
  businessNotFound: string; updateFailed: string; createFailed: string; duplicateDuration: string; durationInUse: string; durationSaveFailed: string; unexpectedError: string; confirmDelete: string;
  deleteFailed: string;
}> = {
  en: {
    title: 'Services', subtitle: 'Manage services and pricing', allCategories: 'All categories', listView: 'List view',
    gridView: 'Grid view', importTitle: 'Import services from CSV', importButton: 'Import', addService: 'Add service',
    serviceCountOne: '1 service', serviceCountMany: '{count} services', uncategorized: 'Uncategorized', hidden: 'Hidden',
    couplesAvailable: 'Couples available', couples: 'Couples', edit: 'Edit', delete: 'Delete', durationsPricing: 'Durations & pricing',
    minutesValue: '{minutes} min', noImage: 'No image', editService: 'Edit service', newService: 'New service', close: 'Close',
    serviceName: 'Service name', description: 'Description', category: 'Category', selectCategory: 'Select a category…',
    createCategory: '+ Create new category', newCategoryPlaceholder: 'Enter new category name',
    backToCategories: '← Back to existing categories', imageUrl: 'Image URL (optional)',
    stockPhotosBefore: 'Recommended: use free stock photos from', stockPhotosOr: 'or', imagePreview: 'Preview',
    availableForCouples: 'Available for couples', hideFromBooking: 'Hide from booking page',
    hideFromBookingHint: "Customers can't book it online. You can still book it here, and existing vouchers stay valid.",
    bufferBefore: 'Buffer before (minutes)', bufferBeforeHint: 'Setup/preparation time before the service',
    bufferAfter: 'Buffer after (minutes)', bufferAfterHint: 'Cleanup/transition time after the service',
    feesTitle: 'No-show & cancellation fees', noShowFee: 'No-show fee ({symbol})', noShowFeeHint: 'Fee for missed appointments',
    lateCancelFee: 'Late cancellation fee ({symbol})', lateCancelFeeHint: 'Fee for late cancellations',
    cancelBefore: 'Cancel before (hours)', cancelBeforeHint: 'Hours of notice required', durationsPrices: 'Durations & prices',
    addDuration: 'Add duration', durationPlaceholder: 'Duration (minutes)', pricePlaceholder: 'Price ({symbol})',
    removeDuration: 'Remove duration', updateService: 'Update service', createService: 'Create service', cancel: 'Cancel',
    limitReached: "You've reached the maximum number of services ({max}) for your {plan} plan. Upgrade to Pro for unlimited services.",
    chooseCategory: 'Please select or create a category.', businessNotFound: 'Business not found.',
    updateFailed: 'Could not update the service: {message}', createFailed: 'Could not create the service: {message}', duplicateDuration: '{minutes} min is listed twice. Keep one price per length.', durationInUse: 'Kept {minutes} min: past bookings or vouchers still use it.', durationSaveFailed: 'Could not save the prices: {message}',
    unexpectedError: 'An unexpected error occurred. Please try again.', confirmDelete: 'Are you sure you want to delete this service?',
    deleteFailed: 'Could not delete the service: {message}',
  },
  de: {
    title: 'Leistungen', subtitle: 'Leistungen und Preise verwalten', allCategories: 'Alle Kategorien', listView: 'Listenansicht',
    gridView: 'Rasteransicht', importTitle: 'Leistungen aus CSV importieren', importButton: 'Importieren', addService: 'Leistung hinzufügen',
    serviceCountOne: '1 Leistung', serviceCountMany: '{count} Leistungen', uncategorized: 'Ohne Kategorie', hidden: 'Ausgeblendet',
    couplesAvailable: 'Paarbuchung möglich', couples: 'Paarbuchung', edit: 'Bearbeiten', delete: 'Löschen', durationsPricing: 'Dauer & Preise',
    minutesValue: '{minutes} Min.', noImage: 'Kein Bild', editService: 'Leistung bearbeiten', newService: 'Neue Leistung', close: 'Schließen',
    serviceName: 'Name der Leistung', description: 'Beschreibung', category: 'Kategorie', selectCategory: 'Kategorie auswählen…',
    createCategory: '+ Neue Kategorie anlegen', newCategoryPlaceholder: 'Name der neuen Kategorie',
    backToCategories: '← Zurück zu bestehenden Kategorien', imageUrl: 'Bild-URL (optional)',
    stockPhotosBefore: 'Tipp: kostenlose Stockfotos von', stockPhotosOr: 'oder', imagePreview: 'Vorschau',
    availableForCouples: 'Als Paarbuchung buchbar', hideFromBooking: 'Auf der Buchungsseite ausblenden',
    hideFromBookingHint: 'Kunden können sie nicht online buchen. Hier ist sie weiterhin buchbar, bestehende Gutscheine bleiben gültig.',
    bufferBefore: 'Puffer davor (Minuten)', bufferBeforeHint: 'Vorbereitungszeit vor der Leistung',
    bufferAfter: 'Puffer danach (Minuten)', bufferAfterHint: 'Nachbereitungszeit nach der Leistung',
    feesTitle: 'No-Show- & Stornogebühren', noShowFee: 'No-Show-Gebühr ({symbol})', noShowFeeHint: 'Gebühr für versäumte Termine',
    lateCancelFee: 'Gebühr für späte Stornierung ({symbol})', lateCancelFeeHint: 'Gebühr für kurzfristige Stornierungen',
    cancelBefore: 'Stornierung bis (Stunden vorher)', cancelBeforeHint: 'Erforderliche Vorlaufzeit in Stunden', durationsPrices: 'Dauer & Preise',
    addDuration: 'Dauer hinzufügen', durationPlaceholder: 'Dauer (Minuten)', pricePlaceholder: 'Preis ({symbol})',
    removeDuration: 'Dauer entfernen', updateService: 'Leistung speichern', createService: 'Leistung anlegen', cancel: 'Abbrechen',
    limitReached: 'Die maximale Anzahl an Leistungen ({max}) für Ihren {plan}-Tarif ist erreicht. Mit Pro sind unbegrenzt viele Leistungen möglich.',
    chooseCategory: 'Bitte eine Kategorie auswählen oder anlegen.', businessNotFound: 'Unternehmen nicht gefunden.',
    updateFailed: 'Leistung konnte nicht gespeichert werden: {message}', createFailed: 'Leistung konnte nicht angelegt werden: {message}', duplicateDuration: '{minutes} Min. steht doppelt drin. Bitte nur einen Preis pro Dauer.', durationInUse: '{minutes} Min. bleibt bestehen: Frühere Buchungen oder Gutscheine nutzen diese Dauer noch.', durationSaveFailed: 'Preise konnten nicht gespeichert werden: {message}',
    unexpectedError: 'Ein unerwarteter Fehler ist aufgetreten. Bitte erneut versuchen.', confirmDelete: 'Diese Leistung wirklich löschen?',
    deleteFailed: 'Leistung konnte nicht gelöscht werden: {message}',
  },
  th: {
    title: 'บริการ', subtitle: 'จัดการบริการและราคา', allCategories: 'ทุกหมวดหมู่', listView: 'มุมมองรายการ',
    gridView: 'มุมมองตาราง', importTitle: 'นำเข้าบริการจากไฟล์ CSV', importButton: 'นำเข้า', addService: 'เพิ่มบริการ',
    serviceCountOne: '1 บริการ', serviceCountMany: '{count} บริการ', uncategorized: 'ไม่มีหมวดหมู่', hidden: 'ซ่อนอยู่',
    couplesAvailable: 'จองคู่ได้', couples: 'จองคู่', edit: 'แก้ไข', delete: 'ลบ', durationsPricing: 'ระยะเวลาและราคา',
    minutesValue: '{minutes} นาที', noImage: 'ไม่มีรูปภาพ', editService: 'แก้ไขบริการ', newService: 'บริการใหม่', close: 'ปิด',
    serviceName: 'ชื่อบริการ', description: 'รายละเอียด', category: 'หมวดหมู่', selectCategory: 'เลือกหมวดหมู่…',
    createCategory: '+ สร้างหมวดหมู่ใหม่', newCategoryPlaceholder: 'ใส่ชื่อหมวดหมู่ใหม่',
    backToCategories: '← กลับไปที่หมวดหมู่ที่มีอยู่', imageUrl: 'URL รูปภาพ (ไม่บังคับ)',
    stockPhotosBefore: 'แนะนำ: ใช้รูปสต็อกฟรีจาก', stockPhotosOr: 'หรือ', imagePreview: 'ตัวอย่าง',
    availableForCouples: 'เปิดให้จองคู่', hideFromBooking: 'ซ่อนจากหน้าจอง',
    hideFromBookingHint: 'ลูกค้าจะจองออนไลน์ไม่ได้ แต่ยังจองจากที่นี่ได้ และบัตรกำนัลที่มีอยู่ยังใช้ได้',
    bufferBefore: 'เวลาเผื่อก่อน (นาที)', bufferBeforeHint: 'เวลาเตรียมตัวก่อนให้บริการ',
    bufferAfter: 'เวลาเผื่อหลัง (นาที)', bufferAfterHint: 'เวลาเก็บกวาดหลังให้บริการ',
    feesTitle: 'ค่าธรรมเนียมไม่มาตามนัดและการยกเลิก', noShowFee: 'ค่าธรรมเนียมไม่มาตามนัด ({symbol})', noShowFeeHint: 'ค่าธรรมเนียมเมื่อลูกค้าไม่มาตามนัด',
    lateCancelFee: 'ค่ายกเลิกล่าช้า ({symbol})', lateCancelFeeHint: 'ค่าธรรมเนียมเมื่อยกเลิกกระชั้นชิด',
    cancelBefore: 'ยกเลิกล่วงหน้า (ชั่วโมง)', cancelBeforeHint: 'จำนวนชั่วโมงที่ต้องแจ้งล่วงหน้า', durationsPrices: 'ระยะเวลาและราคา',
    addDuration: 'เพิ่มระยะเวลา', durationPlaceholder: 'ระยะเวลา (นาที)', pricePlaceholder: 'ราคา ({symbol})',
    removeDuration: 'ลบระยะเวลา', updateService: 'บันทึกบริการ', createService: 'สร้างบริการ', cancel: 'ยกเลิก',
    limitReached: 'คุณมีบริการครบจำนวนสูงสุด ({max}) ของแพ็กเกจ {plan} แล้ว อัปเกรดเป็น Pro เพื่อเพิ่มบริการได้ไม่จำกัด',
    chooseCategory: 'กรุณาเลือกหรือสร้างหมวดหมู่', businessNotFound: 'ไม่พบข้อมูลร้าน',
    updateFailed: 'อัปเดตบริการไม่สำเร็จ: {message}', createFailed: 'สร้างบริการไม่สำเร็จ: {message}', duplicateDuration: '{minutes} นาที ซ้ำกัน กรุณาใส่ราคาเดียวต่อระยะเวลา', durationInUse: 'เก็บ {minutes} นาทีไว้ เพราะยังมีการจองหรือบัตรของขวัญที่ใช้อยู่', durationSaveFailed: 'บันทึกราคาไม่สำเร็จ: {message}',
    unexpectedError: 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองอีกครั้ง', confirmDelete: 'ต้องการลบบริการนี้ใช่หรือไม่',
    deleteFailed: 'ลบบริการไม่สำเร็จ: {message}',
  },
};

interface Service {
  id: string;
  name: string;
  description: string;
  is_pair_massage: boolean;
  is_hidden?: boolean;
  image_url: string | null;
  category: string;
  display_order: number;
  buffer_before: number;
  buffer_after: number;
  no_show_fee: number;
  late_cancel_fee: number;
  late_cancel_hours: number;
}

const FOREIGN_KEY_VIOLATION = '23503';

interface ServiceDuration {
  id: string;
  service_id: string;
  duration_minutes: number;
  price_cents: number;
}

export default function ServicesView() {
  const { formatPrice, currencySymbol } = useCurrency();
  const { t } = useAdminText(TEXT);
  const tenant = useTenant();
  const premiumFeatures = usePremiumFeatures();
  const [services, setServices] = useState<Service[]>([]);
  const [durations, setDurations] = useState<{ [key: string]: ServiceDuration[] }>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_pair_massage: false,
    is_hidden: false,
    image_url: '',
    category: '',
    display_order: 0,
    buffer_before: 0,
    buffer_after: 0,
    no_show_fee: 0,
    late_cancel_fee: 0,
    late_cancel_hours: 24,
  });
  const [serviceDurations, setServiceDurations] = useState<EditedDuration[]>([
    { duration_minutes: 60, price_cents: 8900 },
  ]);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [draggedService, setDraggedService] = useState<Service | null>(null);
  const [dragOverService, setDragOverService] = useState<Service | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    if (!tenant.businessId) return;

    const { data: servicesData } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', tenant.businessId)
      .order('category')
      .order('display_order')
      .order('name');

    if (!servicesData) return;

    const serviceIds = servicesData.map(s => s.id);

    const { data: durationsData } = serviceIds.length > 0
      ? await supabase
          .from('service_durations')
          .select('*')
          .in('service_id', serviceIds)
          .order('duration_minutes')
      : { data: [] };

    if (servicesData) {
      setServices(servicesData);

      const categories = servicesData
        .map(s => s.category)
        .filter((cat): cat is string => cat !== null && cat !== '')
        .filter((cat, index, self) => self.indexOf(cat) === index)
        .sort();
      setExistingCategories(categories);
    }

    if (durationsData) {
      const grouped = durationsData.reduce((acc: any, duration: any) => {
        if (!acc[duration.service_id]) {
          acc[duration.service_id] = [];
        }
        acc[duration.service_id].push(duration);
        return acc;
      }, {});
      setDurations(grouped);
    }

    setLoading(false);
  };

  const openCreateModal = () => {
    if (!premiumFeatures.isLoading) {
      const { limits } = premiumFeatures;

      if (limits && limits.maxServices !== null && limits.currentServices >= limits.maxServices) {
        alert(fillText(t.limitReached, { max: limits.maxServices, plan: premiumFeatures.planType.toUpperCase() }));
        return;
      }
    }

    setEditingService(null);
    setFormData({
      name: '',
      description: '',
      is_pair_massage: false,
      is_hidden: false,
      image_url: '',
      category: '',
      display_order: 0,
      buffer_before: 0,
      buffer_after: 0,
      no_show_fee: 0,
      late_cancel_fee: 0,
      late_cancel_hours: 24,
    });
    setServiceDurations([{ duration_minutes: 60, price_cents: 8900 }]);
    setIsCreatingNewCategory(false);
    setNewCategoryName('');
    setShowModal(true);
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description,
      is_pair_massage: service.is_pair_massage,
      is_hidden: service.is_hidden ?? false,
      image_url: service.image_url || '',
      category: service.category || '',
      display_order: service.display_order || 0,
      buffer_before: service.buffer_before || 0,
      buffer_after: service.buffer_after || 0,
      no_show_fee: service.no_show_fee || 0,
      late_cancel_fee: service.late_cancel_fee || 0,
      late_cancel_hours: service.late_cancel_hours || 24,
    });
    setServiceDurations(
      durations[service.id]?.map(d => ({
        id: d.id,
        duration_minutes: d.duration_minutes,
        price_cents: d.price_cents,
      })) || [{ duration_minutes: 60, price_cents: 8900 }]
    );
    setIsCreatingNewCategory(false);
    setNewCategoryName('');
    setShowModal(true);
  };

  /**
   * Saves the price list by updating rows in place (same id), so bookings and
   * vouchers that point at a price keep working. Returns the lengths that could
   * not be removed because something still uses them, or null after an error.
   */
  const saveDurations = async (serviceId: string): Promise<number[] | null> => {
    const plan = planDurationChanges(durations[serviceId] ?? [], serviceDurations);
    const fail = (error: { message: string }) => {
      console.error('Error saving service prices:', error);
      alert(fillText(t.durationSaveFailed, { message: error.message }));
      return null;
    };

    for (const row of plan.updates) {
      const { error } = await supabase
        .from('service_durations')
        .update({ duration_minutes: row.duration_minutes, price_cents: row.price_cents, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) return fail(error);
    }
    if (plan.inserts.length > 0) {
      const { error } = await supabase.from('service_durations').insert(plan.inserts.map((row) => ({
        business_id: tenant.businessId,
        service_id: serviceId,
        duration_minutes: row.duration_minutes,
        price_cents: row.price_cents,
      })));
      if (error) return fail(error);
    }
    const inUse: number[] = [];
    for (const row of plan.deletes) {
      const { error } = await supabase.from('service_durations').delete().eq('id', row.id);
      if (error?.code === FOREIGN_KEY_VIOLATION) inUse.push(row.duration_minutes);
      else if (error) return fail(error);
    }
    return inUse;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const repeated = duplicateMinutes(serviceDurations);
    if (repeated !== null) {
      alert(fillText(t.duplicateDuration, { minutes: repeated }));
      return;
    }

    const categoryToSave = isCreatingNewCategory ? newCategoryName.trim() : formData.category;

    if (!categoryToSave) {
      alert(t.chooseCategory);
      return;
    }

    try {
      if (!tenant.businessId) {
        alert(t.businessNotFound);
        return;
      }

      if (editingService) {
        const { error: updateError } = await supabase
          .from('services')
          .update({
            name: formData.name,
            description: formData.description,
            is_pair_massage: formData.is_pair_massage,
            is_hidden: formData.is_hidden,
            image_url: formData.image_url || null,
            category: categoryToSave,
            display_order: formData.display_order,
            buffer_before: formData.buffer_before,
            buffer_after: formData.buffer_after,
            no_show_fee: formData.no_show_fee,
            late_cancel_fee: formData.late_cancel_fee,
            late_cancel_hours: formData.late_cancel_hours,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingService.id)
          .eq('business_id', tenant.businessId);

        if (updateError) {
          console.error('Error updating service:', updateError);
          alert(fillText(t.updateFailed, { message: updateError.message }));
          return;
        }

        const inUse = await saveDurations(editingService.id);
        if (inUse === null) return;
        if (inUse.length > 0) alert(inUse.map((minutes) => fillText(t.durationInUse, { minutes })).join('\n'));
      } else {
        const { data: newService, error: insertError } = await supabase
          .from('services')
          .insert({
            business_id: tenant.businessId,
            name: formData.name,
            description: formData.description,
            is_pair_massage: formData.is_pair_massage,
            is_hidden: formData.is_hidden,
            image_url: formData.image_url || null,
            category: categoryToSave,
            display_order: formData.display_order,
            buffer_before: formData.buffer_before,
            buffer_after: formData.buffer_after,
            no_show_fee: formData.no_show_fee,
            late_cancel_fee: formData.late_cancel_fee,
            late_cancel_hours: formData.late_cancel_hours,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating service:', insertError);
          alert(fillText(t.createFailed, { message: insertError.message }));
          return;
        }

        if (newService && (await saveDurations(newService.id)) === null) return;
      }

      setShowModal(false);
      await fetchServices();
    } catch (error) {
      console.error('Error saving service:', error);
      alert(t.unexpectedError);
    }
  };

  const deleteService = async (serviceId: string) => {
    if (!confirm(t.confirmDelete)) return;
    if (!tenant.businessId) return;

    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', serviceId)
      .eq('business_id', tenant.businessId);

    if (error) {
      console.error('Error deleting service:', error);
      alert(fillText(t.deleteFailed, { message: error.message }));
      return;
    }
    fetchServices();
  };

  const addDuration = () => {
    setServiceDurations([...serviceDurations, { duration_minutes: 60, price_cents: 8900 }]);
  };

  const removeDuration = (index: number) => {
    setServiceDurations(serviceDurations.filter((_, i) => i !== index));
  };

  const updateDuration = (index: number, field: string, value: number) => {
    const updated = [...serviceDurations];
    updated[index] = { ...updated[index], [field]: value };
    setServiceDurations(updated);
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  const toggleCategory = (category: string) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(category)) {
      newCollapsed.delete(category);
    } else {
      newCollapsed.add(category);
    }
    setCollapsedCategories(newCollapsed);
  };

  const getServicesByCategory = () => {
    const grouped: { [key: string]: Service[] } = {};
    services.forEach(service => {
      const cat = service.category || t.uncategorized;
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(service);
    });
    return grouped;
  };

  const handleDragStart = (e: React.DragEvent, service: Service) => {
    setDraggedService(service);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetService: Service) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedService &&
        draggedService.category === targetService.category &&
        draggedService.id !== targetService.id) {
      setDragOverService(targetService);
    }
  };

  const handleDragEnd = () => {
    setDraggedService(null);
    setDragOverService(null);
  };

  const handleDrop = async (e: React.DragEvent, targetService: Service) => {
    e.preventDefault();

    if (!draggedService || draggedService.id === targetService.id) {
      setDraggedService(null);
      setDragOverService(null);
      return;
    }

    if (draggedService.category !== targetService.category) {
      setDraggedService(null);
      setDragOverService(null);
      return;
    }

    const categoryServices = services.filter(s => s.category === draggedService.category);
    const draggedIndex = categoryServices.findIndex(s => s.id === draggedService.id);
    const targetIndex = categoryServices.findIndex(s => s.id === targetService.id);

    const reordered = [...categoryServices];
    reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, draggedService);

    const otherServices = services.filter(s => s.category !== draggedService.category);
    const newServices = [...otherServices, ...reordered].sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return reordered.indexOf(a) - reordered.indexOf(b);
    });

    setServices(newServices);
    setDraggedService(null);
    setDragOverService(null);

    for (let i = 0; i < reordered.length; i++) {
      supabase
        .from('services')
        .update({ display_order: i })
        .eq('id', reordered[i].id)
        .then();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1714] mb-1">{t.title}</h1>
          <p className="text-gray-600">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A1714] focus:border-transparent transition-all"
          >
            <option value="all">{t.allCategories}</option>
            {existingCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              title={t.listView}
              aria-label={t.listView}
            >
              <LayoutList className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              title={t.gridView}
              aria-label={t.gridView}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
            title={t.importTitle}
          >
            <Upload className="w-5 h-5" />
            <span className="font-medium">{t.importButton}</span>
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center space-x-2 px-5 py-2.5 bg-[#1A1714] text-white rounded-lg hover:bg-[#2E2926] transition-all shadow-sm hover:shadow-md"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">{t.addService}</span>
          </button>
        </div>
      </div>

      {selectedCategory === 'all' ? (
        <div className="space-y-8">
          {Object.entries(getServicesByCategory()).map(([category, categoryServices]) => (
            <div key={category} className="space-y-4">
              <button
                onClick={() => toggleCategory(category)}
                className="flex items-center justify-between w-full p-5 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-all border-l-4 border-[#1A1714] rounded-r-lg shadow-sm"
              >
                <div className="flex items-center space-x-3">
                  <h2 className="text-lg font-semibold tracking-tight text-[#1A1714]">{category}</h2>
                  <span className="text-sm px-3 py-1 bg-white rounded-full text-gray-600 font-medium shadow-sm">
                    {categoryServices.length === 1 ? t.serviceCountOne : fillText(t.serviceCountMany, { count: categoryServices.length })}
                  </span>
                </div>
                <span className="text-gray-500 text-lg">
                  {collapsedCategories.has(category) ? '▼' : '▲'}
                </span>
              </button>

              {!collapsedCategories.has(category) && (
                viewMode === 'list' ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {categoryServices.map((service) => (
                      <div
                        key={service.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, service)}
                        onDragOver={(e) => handleDragOver(e, service)}
                        onDragEnd={handleDragEnd}
                        onDrop={(e) => handleDrop(e, service)}
                        className={`bg-white border rounded-xl p-6 cursor-move transition-all ${
                          draggedService?.id === service.id
                            ? 'opacity-50 scale-95'
                            : dragOverService?.id === service.id
                            ? 'border-[#1A1714] border-2 shadow-xl scale-105'
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-lg'
                        }`}
                      >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start space-x-3 flex-1">
                <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1 hover:text-gray-600 transition-colors" />
                <div className="flex-1">
                  {service.category && (
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">{service.category}</p>
                  )}
                  <h3 className="text-lg font-semibold tracking-tight text-[#1A1714] mb-1">
                    {service.name}
                    {service.is_hidden && (
                      <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 align-middle text-[11px] font-medium text-stone-600">{t.hidden}</span>
                    )}
                    {service.is_pair_massage && (
                      <span className="ml-2 text-xs px-3 py-1 bg-[#1A1714] bg-opacity-10 text-[#1A1714] rounded-full font-medium">
                        {t.couplesAvailable}
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{service.description}</p>
                </div>
              </div>
              <div className="flex space-x-2 ml-4">
                <button
                  onClick={() => openEditModal(service)}
                  title={t.edit}
                  aria-label={t.edit}
                  className="p-2 text-gray-500 hover:text-[#1A1714] hover:bg-gray-100 rounded-lg transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteService(service.id)}
                  title={t.delete}
                  aria-label={t.delete}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">{t.durationsPricing}</p>
              {durations[service.id]?.map((duration) => (
                <div key={duration.id} className="flex justify-between items-center text-sm py-2.5 px-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <span className="text-gray-700 font-medium">{fillText(t.minutesValue, { minutes: duration.duration_minutes })}</span>
                  <span className="text-gray-900 font-semibold">{formatPrice(duration.price_cents)}</span>
                </div>
              ))}
            </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {categoryServices.map((service) => (
                      <div
                        key={service.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, service)}
                        onDragOver={(e) => handleDragOver(e, service)}
                        onDragEnd={handleDragEnd}
                        onDrop={(e) => handleDrop(e, service)}
                        className={`bg-white border overflow-hidden cursor-move transition-all group ${
                          draggedService?.id === service.id
                            ? 'opacity-50 scale-95'
                            : dragOverService?.id === service.id
                            ? 'border-stone-800 border-2 shadow-lg scale-105'
                            : 'border-stone-200 hover:border-stone-400'
                        }`}
                      >
              <div className="relative aspect-[4/3] bg-stone-100">
                {service.image_url ? (
                  <img
                    src={service.image_url}
                    alt={service.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-400">
                    <span className="text-sm">{t.noImage}</span>
                  </div>
                )}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
                  <button
                    onClick={() => openEditModal(service)}
                    title={t.edit}
                    aria-label={t.edit}
                    className="p-2 bg-white rounded shadow-lg text-stone-600 hover:text-stone-800"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteService(service.id)}
                    title={t.delete}
                    aria-label={t.delete}
                    className="p-2 bg-white rounded shadow-lg text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="absolute top-2 left-2">
                  <GripVertical className="w-5 h-5 text-white drop-shadow-lg" />
                </div>
              </div>
              <div className="p-4">
                {service.category && (
                  <p className="text-xs text-stone-500 mb-1">{service.category}</p>
                )}
                <h3 className="text-base font-medium text-stone-800 mb-1">
                  {service.name}
                  {service.is_hidden && (
                    <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 align-middle text-[11px] font-medium text-stone-600">{t.hidden}</span>
                  )}
                  {service.is_pair_massage && (
                    <span className="ml-2 text-xs px-2 py-0.5 bg-stone-200 text-stone-700 rounded-full">
                      {t.couples}
                    </span>
                  )}
                </h3>
                <p className="text-sm text-stone-600 mb-3 line-clamp-2">{service.description}</p>
                <div className="space-y-1">
                  {durations[service.id]?.map((duration) => (
                    <div key={duration.id} className="flex justify-between text-xs">
                      <span className="text-stone-600">{fillText(t.minutesValue, { minutes: duration.duration_minutes })}</span>
                      <span className="text-stone-800 font-medium">{formatPrice(duration.price_cents)}</span>
                    </div>
                  ))}
                </div>
              </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {viewMode === 'list' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {services
                .filter(s => s.category === selectedCategory)
                .map((service) => (
                  <div
                    key={service.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, service)}
                    onDragOver={(e) => handleDragOver(e, service)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, service)}
                    className={`bg-white border p-6 cursor-move transition-all ${
                      draggedService?.id === service.id
                        ? 'opacity-50 scale-95'
                        : dragOverService?.id === service.id
                        ? 'border-stone-800 border-2 shadow-lg scale-105'
                        : 'border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start space-x-3 flex-1">
                        <GripVertical className="w-5 h-5 text-stone-400 flex-shrink-0 mt-1" />
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-stone-800 mb-1">
                            {service.name}
                            {service.is_hidden && (
                              <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 align-middle text-[11px] font-medium text-stone-600">{t.hidden}</span>
                            )}
                            {service.is_pair_massage && (
                              <span className="ml-2 text-xs px-2 py-1 bg-stone-200 text-stone-700 rounded-full">
                                {t.couplesAvailable}
                              </span>
                            )}
                          </h3>
                          <p className="text-sm text-stone-600">{service.description}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => openEditModal(service)}
                          title={t.edit}
                          aria-label={t.edit}
                          className="text-stone-600 hover:text-stone-800"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteService(service.id)}
                          title={t.delete}
                          aria-label={t.delete}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-stone-700 uppercase tracking-wider">{t.durationsPricing}</p>
                      {durations[service.id]?.map((duration) => (
                        <div key={duration.id} className="flex justify-between text-sm py-2 border-t border-stone-100">
                          <span className="text-stone-600">{fillText(t.minutesValue, { minutes: duration.duration_minutes })}</span>
                          <span className="text-stone-800 font-medium">{formatPrice(duration.price_cents)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {services
                .filter(s => s.category === selectedCategory)
                .map((service) => (
                  <div
                    key={service.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, service)}
                    onDragOver={(e) => handleDragOver(e, service)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, service)}
                    className={`bg-white border overflow-hidden cursor-move transition-all group ${
                      draggedService?.id === service.id
                        ? 'opacity-50 scale-95'
                        : dragOverService?.id === service.id
                        ? 'border-stone-800 border-2 shadow-lg scale-105'
                        : 'border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    <div className="relative aspect-[4/3] bg-stone-100">
                      {service.image_url ? (
                        <img
                          src={service.image_url}
                          alt={service.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-400">
                          <span className="text-sm">{t.noImage}</span>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
                        <button
                          onClick={() => openEditModal(service)}
                          title={t.edit}
                          aria-label={t.edit}
                          className="p-2 bg-white rounded shadow-lg text-stone-600 hover:text-stone-800"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteService(service.id)}
                          title={t.delete}
                          aria-label={t.delete}
                          className="p-2 bg-white rounded shadow-lg text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="absolute top-2 left-2">
                        <GripVertical className="w-5 h-5 text-white drop-shadow-lg" />
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="text-base font-medium text-stone-800 mb-1">
                        {service.name}
                        {service.is_hidden && (
                          <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 align-middle text-[11px] font-medium text-stone-600">{t.hidden}</span>
                        )}
                        {service.is_pair_massage && (
                          <span className="ml-2 text-xs px-2 py-0.5 bg-stone-200 text-stone-700 rounded-full">
                            {t.couples}
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-stone-600 mb-3 line-clamp-2">{service.description}</p>
                      <div className="space-y-1">
                        {durations[service.id]?.map((duration) => (
                          <div key={duration.id} className="flex justify-between text-xs">
                            <span className="text-stone-600">{fillText(t.minutesValue, { minutes: duration.duration_minutes })}</span>
                            <span className="text-stone-800 font-medium">{formatPrice(duration.price_cents)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-semibold tracking-tight text-[#1A1714]">
                {editingService ? t.editService : t.newService}
              </h2>
              <button onClick={() => setShowModal(false)} title={t.close} aria-label={t.close} className="text-stone-400 hover:text-stone-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">{t.serviceName}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">{t.description}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800 resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">{t.category}</label>
                  {!isCreatingNewCategory ? (
                    <div className="space-y-2">
                      <select
                        value={formData.category}
                        onChange={(e) => {
                          if (e.target.value === '__create_new__') {
                            setIsCreatingNewCategory(true);
                            setFormData({ ...formData, category: '' });
                          } else {
                            setFormData({ ...formData, category: e.target.value });
                          }
                        }}
                        className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
                        required={!isCreatingNewCategory}
                      >
                        <option value="">{t.selectCategory}</option>
                        {existingCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                        <option value="__create_new__">{t.createCategory}</option>
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
                        placeholder={t.newCategoryPlaceholder}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingNewCategory(false);
                          setNewCategoryName('');
                        }}
                        className="text-sm text-stone-600 hover:text-stone-800"
                      >
                        {t.backToCategories}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">{t.imageUrl}</label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
                  placeholder="https://example.com/image.jpg"
                />
                <p className="text-xs text-stone-500 mt-1">
                  {t.stockPhotosBefore}{' '}
                  <a
                    href="https://www.pexels.com/search/massage/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-700 hover:underline"
                  >
                    Pexels
                  </a>
                  {' '}{t.stockPhotosOr}{' '}
                  <a
                    href="https://unsplash.com/s/photos/massage"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-700 hover:underline"
                  >
                    Unsplash
                  </a>
                </p>
                {formData.image_url && (
                  <div className="mt-3">
                    <img
                      src={formData.image_url}
                      alt={t.imagePreview}
                      className="w-full h-48 object-cover border border-stone-200"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.is_pair_massage}
                    onChange={(e) => setFormData({ ...formData, is_pair_massage: e.target.checked })}
                    className="w-4 h-4 text-stone-800 focus:ring-stone-500"
                  />
                  <span className="text-sm text-stone-700">{t.availableForCouples}</span>
                </label>
                <label className="mt-3 flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_hidden}
                    onChange={(e) => setFormData({ ...formData, is_hidden: e.target.checked })}
                    className="w-4 h-4 text-stone-800 focus:ring-stone-500"
                  />
                  <span className="text-sm text-stone-700">
                    {t.hideFromBooking}
                    <span className="block text-xs text-stone-500">{t.hideFromBookingHint}</span>
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    {t.bufferBefore}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.buffer_before}
                    onChange={(e) => setFormData({ ...formData, buffer_before: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
                  />
                  <p className="text-xs text-stone-500 mt-1">{t.bufferBeforeHint}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    {t.bufferAfter}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.buffer_after}
                    onChange={(e) => setFormData({ ...formData, buffer_after: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
                  />
                  <p className="text-xs text-stone-500 mt-1">{t.bufferAfterHint}</p>
                </div>
              </div>

              <div className="border-t border-stone-200 pt-6">
                <h3 className="text-sm font-medium text-stone-700 mb-4">{t.feesTitle}</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">
                      {fillText(t.noShowFee, { symbol: currencySymbol })}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.no_show_fee / 100}
                      onChange={(e) => setFormData({ ...formData, no_show_fee: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                      className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
                    />
                    <p className="text-xs text-stone-500 mt-1">{t.noShowFeeHint}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">
                      {fillText(t.lateCancelFee, { symbol: currencySymbol })}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.late_cancel_fee / 100}
                      onChange={(e) => setFormData({ ...formData, late_cancel_fee: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                      className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
                    />
                    <p className="text-xs text-stone-500 mt-1">{t.lateCancelFeeHint}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">
                      {t.cancelBefore}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.late_cancel_hours}
                      onChange={(e) => setFormData({ ...formData, late_cancel_hours: parseInt(e.target.value) || 24 })}
                      className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
                    />
                    <p className="text-xs text-stone-500 mt-1">{t.cancelBeforeHint}</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-stone-700">{t.durationsPrices}</label>
                  <button
                    type="button"
                    onClick={addDuration}
                    className="text-sm text-stone-600 hover:text-stone-800 flex items-center space-x-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t.addDuration}</span>
                  </button>
                </div>
                <div className="space-y-3">
                  {serviceDurations.map((duration, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <input
                        type="number"
                        value={duration.duration_minutes}
                        onChange={(e) => updateDuration(index, 'duration_minutes', parseInt(e.target.value))}
                        className="flex-1 px-4 py-2 border border-stone-200 focus:outline-none focus:border-stone-800"
                        placeholder={t.durationPlaceholder}
                        min="15"
                        step="15"
                        required
                      />
                      <input
                        type="number"
                        value={duration.price_cents / 100}
                        onChange={(e) => updateDuration(index, 'price_cents', Math.round(parseFloat(e.target.value) * 100))}
                        className="flex-1 px-4 py-2 border border-stone-200 focus:outline-none focus:border-stone-800"
                        placeholder={fillText(t.pricePlaceholder, { symbol: currencySymbol })}
                        min="0"
                        step="0.01"
                        required
                      />
                      {serviceDurations.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDuration(index)}
                          title={t.removeDuration}
                          aria-label={t.removeDuration}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-stone-800 text-white hover:bg-stone-700 transition-colors"
                >
                  {editingService ? t.updateService : t.createService}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  {t.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <ImportServicesModal
          onClose={() => setShowImportModal(false)}
          onImportComplete={() => {
            fetchServices();
            setShowImportModal(false);
          }}
        />
      )}
    </div>
  );
}
