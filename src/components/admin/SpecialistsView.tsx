import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';
import { Plus, Edit2, Trash2, X, Clock, Calendar, CalendarOff } from 'lucide-react';
import WorkingHoursModal from './WorkingHoursModal';
import TimeBlocksModal from './TimeBlocksModal';
import SpecialistChoiceSetting from './SpecialistChoiceSetting';
import { usePremiumFeatures } from '../../hooks/usePremiumFeatures';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, type Translations } from '../../lib/bookingLanguage';

const TEXT: Translations<{
  staffLimit: string; businessNotFound: string; confirmDelete: string; title: string; subtitle: string;
  allSpecialists: string; closedDays: string; addSpecialist: string; inactive: string; workingHours: string;
  timeBlocks: string; edit: string; delete: string; services: string; noServices: string; editTitle: string;
  newTitle: string; close: string; fullName: string; bio: string; bioPlaceholder: string; imageUrl: string;
  activeLabel: string; servicesOffered: string; update: string; create: string; cancel: string;
}> = {
  en: {
    staffLimit: "You've reached the maximum number of staff ({max}) for your {plan} plan. Upgrade to Pro for unlimited staff.",
    businessNotFound: 'Business not found', confirmDelete: 'Are you sure you want to delete this specialist?',
    title: 'Specialists', subtitle: 'Manage massage therapists', allSpecialists: 'Applies to every specialist',
    closedDays: 'Shop closed days', addSpecialist: 'Add Specialist', inactive: 'Inactive', workingHours: 'Working Hours',
    timeBlocks: 'Time Blocks', edit: 'Edit', delete: 'Delete', services: 'Services', noServices: 'No services assigned',
    editTitle: 'Edit Specialist', newTitle: 'New Specialist', close: 'Close', fullName: 'Full Name', bio: 'Bio',
    bioPlaceholder: 'Brief description of expertise and experience...', imageUrl: 'Image URL (optional)',
    activeLabel: 'Active (available for bookings)', servicesOffered: 'Services Offered', update: 'Update Specialist',
    create: 'Create Specialist', cancel: 'Cancel',
  },
  de: {
    staffLimit: 'Sie haben die maximale Anzahl an Mitarbeiter:innen ({max}) für Ihren {plan}-Tarif erreicht. Mit Pro sind unbegrenzt viele möglich.',
    businessNotFound: 'Betrieb nicht gefunden', confirmDelete: 'Diese:n Therapeut:in wirklich löschen?',
    title: 'Therapeut:innen', subtitle: 'Massagetherapeut:innen verwalten', allSpecialists: 'Gilt für alle Therapeut:innen',
    closedDays: 'Schließtage', addSpecialist: 'Therapeut:in hinzufügen', inactive: 'Inaktiv', workingHours: 'Arbeitszeiten',
    timeBlocks: 'Zeitblöcke', edit: 'Bearbeiten', delete: 'Löschen', services: 'Leistungen', noServices: 'Keine Leistungen zugewiesen',
    editTitle: 'Therapeut:in bearbeiten', newTitle: 'Neue:r Therapeut:in', close: 'Schließen', fullName: 'Vollständiger Name', bio: 'Kurzprofil',
    bioPlaceholder: 'Kurze Beschreibung von Fachgebiet und Erfahrung…', imageUrl: 'Bild-URL (optional)',
    activeLabel: 'Aktiv (für Buchungen verfügbar)', servicesOffered: 'Angebotene Leistungen', update: 'Änderungen speichern',
    create: 'Therapeut:in anlegen', cancel: 'Abbrechen',
  },
  th: {
    staffLimit: 'คุณมีพนักงานครบจำนวนสูงสุด ({max} คน) ของแพ็กเกจ {plan} แล้ว อัปเกรดเป็น Pro เพื่อเพิ่มพนักงานได้ไม่จำกัด',
    businessNotFound: 'ไม่พบธุรกิจ', confirmDelete: 'ต้องการลบพนักงานบริการคนนี้ใช่หรือไม่?',
    title: 'พนักงานบริการ', subtitle: 'จัดการพนักงานนวด', allSpecialists: 'ใช้กับพนักงานบริการทุกคน',
    closedDays: 'วันปิดร้าน', addSpecialist: 'เพิ่มพนักงานบริการ', inactive: 'ไม่ใช้งาน', workingHours: 'เวลาทำงาน',
    timeBlocks: 'ช่วงเวลาที่ไม่ว่าง', edit: 'แก้ไข', delete: 'ลบ', services: 'บริการ', noServices: 'ยังไม่ได้กำหนดบริการ',
    editTitle: 'แก้ไขพนักงานบริการ', newTitle: 'พนักงานบริการใหม่', close: 'ปิด', fullName: 'ชื่อ-นามสกุล', bio: 'ประวัติย่อ',
    bioPlaceholder: 'อธิบายความเชี่ยวชาญและประสบการณ์สั้นๆ…', imageUrl: 'URL รูปภาพ (ไม่บังคับ)',
    activeLabel: 'ใช้งาน (รับการจองได้)', servicesOffered: 'บริการที่ให้', update: 'บันทึกการแก้ไข',
    create: 'เพิ่มพนักงานบริการ', cancel: 'ยกเลิก',
  },
};

interface Specialist {
  id: string;
  name: string;
  bio: string | null;
  image_url: string | null;
  is_active: boolean;
}

interface Service {
  id: string;
  name: string;
}

export default function SpecialistsView() {
  const { t } = useAdminText(TEXT);
  const tenant = useTenant();
  const premiumFeatures = usePremiumFeatures();
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [specialistServices, setSpecialistServices] = useState<{ [key: string]: string[] }>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSpecialist, setEditingSpecialist] = useState<Specialist | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    image_url: '',
    is_active: true,
  });
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [workingHoursModal, setWorkingHoursModal] = useState<{ id: string; name: string } | null>(null);
  const [timeBlocksModal, setTimeBlocksModal] = useState<{ id: string | null; name: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!tenant.businessId) return;

    const { data: specialistsData } = await supabase
      .from('specialists')
      .select('*')
      .eq('business_id', tenant.businessId)
      .order('name');

    const { data: servicesData } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', tenant.businessId)
      .order('name');

    if (!specialistsData) return;

    const specialistIds = specialistsData.map(s => s.id);

    const { data: relationsData } = specialistIds.length > 0
      ? await supabase
          .from('specialist_services')
          .select('specialist_id, service_id')
          .in('specialist_id', specialistIds)
      : { data: [] };

    if (specialistsData) {
      setSpecialists(specialistsData);
    }

    if (servicesData) {
      setServices(servicesData);
    }

    if (relationsData) {
      const grouped = relationsData.reduce((acc: any, rel: any) => {
        if (!acc[rel.specialist_id]) {
          acc[rel.specialist_id] = [];
        }
        acc[rel.specialist_id].push(rel.service_id);
        return acc;
      }, {});
      setSpecialistServices(grouped);
    }

    setLoading(false);
  };

  const openCreateModal = () => {
    if (!premiumFeatures.isLoading) {
      const { limits } = premiumFeatures;

      if (limits && limits.maxStaff !== null && limits.currentStaff >= limits.maxStaff) {
        alert(fillText(t.staffLimit, { max: limits.maxStaff, plan: premiumFeatures.planType.toUpperCase() }));
        return;
      }
    }

    setEditingSpecialist(null);
    setFormData({
      name: '',
      bio: '',
      image_url: '',
      is_active: true,
    });
    setSelectedServices([]);
    setShowModal(true);
  };

  const openEditModal = (specialist: Specialist) => {
    setEditingSpecialist(specialist);
    setFormData({
      name: specialist.name,
      bio: specialist.bio || '',
      image_url: specialist.image_url || '',
      is_active: specialist.is_active,
    });
    setSelectedServices(specialistServices[specialist.id] || []);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tenant.businessId) {
      alert(t.businessNotFound);
      return;
    }

    try {
      if (editingSpecialist) {
        await supabase
          .from('specialists')
          .update({
            name: formData.name,
            bio: formData.bio || null,
            image_url: formData.image_url || null,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingSpecialist.id)
          .eq('business_id', tenant.businessId);

        await supabase
          .from('specialist_services')
          .delete()
          .eq('specialist_id', editingSpecialist.id);

        for (const serviceId of selectedServices) {
          await supabase.from('specialist_services').insert({
            business_id: tenant.businessId,
            specialist_id: editingSpecialist.id,
            service_id: serviceId,
          });
        }
      } else {
        const { data: newSpecialist } = await supabase
          .from('specialists')
          .insert({
            business_id: tenant.businessId,
            name: formData.name,
            bio: formData.bio || null,
            image_url: formData.image_url || null,
            is_active: formData.is_active,
          })
          .select()
          .single();

        if (newSpecialist) {
          for (const serviceId of selectedServices) {
            await supabase.from('specialist_services').insert({
              business_id: tenant.businessId,
              specialist_id: newSpecialist.id,
              service_id: serviceId,
            });
          }
        }
      }

      setShowModal(false);
      fetchData();
    } catch (error) {
      console.error('Error saving specialist:', error);
    }
  };

  const deleteSpecialist = async (specialistId: string) => {
    if (!confirm(t.confirmDelete)) return;
    if (!tenant.businessId) return;

    const { error } = await supabase
      .from('specialists')
      .delete()
      .eq('id', specialistId)
      .eq('business_id', tenant.businessId);

    if (!error) {
      fetchData();
    }
  };

  const toggleServiceSelection = (serviceId: string) => {
    if (selectedServices.includes(serviceId)) {
      setSelectedServices(selectedServices.filter(id => id !== serviceId));
    } else {
      setSelectedServices([...selectedServices, serviceId]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1714] mb-1">{t.title}</h1>
          <p className="text-gray-600">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTimeBlocksModal({ id: null, name: t.allSpecialists })}
            className="flex items-center space-x-2 px-4 py-2.5 border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50 transition-all"
          >
            <CalendarOff className="w-5 h-5" />
            <span className="font-medium">{t.closedDays}</span>
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center space-x-2 px-5 py-2.5 bg-[#1A1714] text-white rounded-lg hover:bg-[#2E2926] transition-all shadow-sm hover:shadow-md"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">{t.addSpecialist}</span>
          </button>
        </div>
      </div>

      <SpecialistChoiceSetting />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {specialists.map((specialist) => (
          <div key={specialist.id} className="bg-white/70 backdrop-blur-xl border border-stone-200/70 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold tracking-tight text-[#1A1714] mb-1">
                  {specialist.name}
                  {!specialist.is_active && (
                    <span className="ml-2 text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded-full font-medium">
                      {t.inactive}
                    </span>
                  )}
                </h3>
                {specialist.bio && (
                  <p className="text-sm text-gray-600 mt-2 leading-relaxed">{specialist.bio}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 ml-4">
                <button
                  onClick={() => setWorkingHoursModal({ id: specialist.id, name: specialist.name })}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  title={t.workingHours}
                >
                  <Clock className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTimeBlocksModal({ id: specialist.id, name: specialist.name })}
                  className="p-2 text-gray-500 hover:text-[#1A1714] hover:bg-[#1A1714] hover:bg-opacity-10 rounded-lg transition-all"
                  title={t.timeBlocks}
                >
                  <Calendar className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openEditModal(specialist)}
                  className="p-2 text-gray-500 hover:text-[#1A1714] hover:bg-gray-100 rounded-lg transition-all"
                  title={t.edit}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteSpecialist(specialist.id)}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  title={t.delete}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">{t.services}</p>
              <div className="flex flex-wrap gap-2">
                {specialistServices[specialist.id]?.map(serviceId => {
                  const service = services.find(s => s.id === serviceId);
                  return service ? (
                    <span key={serviceId} className="text-xs px-3 py-1.5 bg-[#1A1714] bg-opacity-10 text-[#1A1714] rounded-full font-medium">
                      {service.name}
                    </span>
                  ) : null;
                })}
                {(!specialistServices[specialist.id] || specialistServices[specialist.id].length === 0) && (
                  <span className="text-xs text-gray-500 italic">{t.noServices}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {workingHoursModal && (
        <WorkingHoursModal
          specialistId={workingHoursModal.id}
          specialistName={workingHoursModal.name}
          onClose={() => setWorkingHoursModal(null)}
        />
      )}

      {timeBlocksModal && (
        <TimeBlocksModal
          specialistId={timeBlocksModal.id}
          specialistName={timeBlocksModal.name}
          onClose={() => setTimeBlocksModal(null)}
        />
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white rounded-t-xl">
              <h2 className="text-2xl font-semibold text-gray-900">
                {editingSpecialist ? t.editTitle : t.newTitle}
              </h2>
              <button onClick={() => setShowModal(false)} aria-label={t.close} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t.fullName}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A1714] focus:border-transparent transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t.bio}</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800 resize-none"
                  placeholder={t.bioPlaceholder}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">{t.imageUrl}</label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-stone-800 focus:ring-stone-500"
                  />
                  <span className="text-sm text-stone-700">{t.activeLabel}</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-3">{t.servicesOffered}</label>
                <div className="space-y-2 max-h-64 overflow-y-auto border border-stone-200 p-4">
                  {services.map((service) => (
                    <label key={service.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedServices.includes(service.id)}
                        onChange={() => toggleServiceSelection(service.id)}
                        className="w-4 h-4 text-stone-800 focus:ring-stone-500"
                      />
                      <span className="text-sm text-stone-700">{service.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-stone-800 text-white hover:bg-stone-700 transition-colors"
                >
                  {editingSpecialist ? t.update : t.create}
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
    </div>
  );
}
