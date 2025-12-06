import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';
import { Plus, Edit2, Trash2, X, Clock, Calendar } from 'lucide-react';
import WorkingHoursModal from './WorkingHoursModal';
import TimeBlocksModal from './TimeBlocksModal';
import { usePremiumFeatures } from '../../hooks/usePremiumFeatures';

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
  const [timeBlocksModal, setTimeBlocksModal] = useState<{ id: string; name: string } | null>(null);

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
        alert(`You've reached the maximum number of staff (${limits.maxStaff}) for your ${premiumFeatures.planType.toUpperCase()} plan. Upgrade to Pro for unlimited staff.`);
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
      alert('Business not found');
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
    if (!confirm('Are you sure you want to delete this specialist?')) return;
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
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Specialists</h1>
          <p className="text-gray-600">Manage massage therapists</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center space-x-2 px-5 py-2.5 bg-[#008374] text-white rounded-lg hover:bg-[#006d5f] transition-all shadow-sm hover:shadow-md"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add Specialist</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {specialists.map((specialist) => (
          <div key={specialist.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {specialist.name}
                  {!specialist.is_active && (
                    <span className="ml-2 text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded-full font-medium">
                      Inactive
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
                  title="Working Hours"
                >
                  <Clock className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTimeBlocksModal({ id: specialist.id, name: specialist.name })}
                  className="p-2 text-gray-500 hover:text-[#008374] hover:bg-[#008374] hover:bg-opacity-10 rounded-lg transition-all"
                  title="Time Blocks"
                >
                  <Calendar className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openEditModal(specialist)}
                  className="p-2 text-gray-500 hover:text-[#008374] hover:bg-gray-100 rounded-lg transition-all"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteSpecialist(specialist.id)}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Services</p>
              <div className="flex flex-wrap gap-2">
                {specialistServices[specialist.id]?.map(serviceId => {
                  const service = services.find(s => s.id === serviceId);
                  return service ? (
                    <span key={serviceId} className="text-xs px-3 py-1.5 bg-[#008374] bg-opacity-10 text-[#008374] rounded-full font-medium">
                      {service.name}
                    </span>
                  ) : null;
                })}
                {(!specialistServices[specialist.id] || specialistServices[specialist.id].length === 0) && (
                  <span className="text-xs text-gray-500 italic">No services assigned</span>
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
                {editingSpecialist ? 'Edit Specialist' : 'New Specialist'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008374] focus:border-transparent transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800 resize-none"
                  placeholder="Brief description of expertise and experience..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Image URL (optional)</label>
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
                  <span className="text-sm text-stone-700">Active (available for bookings)</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-3">Services Offered</label>
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
                  {editingSpecialist ? 'Update Specialist' : 'Create Specialist'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
