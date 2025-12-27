import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';
import { Plus, Edit2, Trash2, X, LayoutList, LayoutGrid, GripVertical, Upload } from 'lucide-react';
import { usePremiumFeatures } from '../../hooks/usePremiumFeatures';
import ImportServicesModal from './ImportServicesModal';

interface Service {
  id: string;
  name: string;
  description: string;
  is_pair_massage: boolean;
  image_url: string | null;
  category: string;
  display_order: number;
  buffer_before: number;
  buffer_after: number;
  no_show_fee: number;
  late_cancel_fee: number;
  late_cancel_hours: number;
}

interface ServiceDuration {
  id: string;
  service_id: string;
  duration_minutes: number;
  price_cents: number;
}

export default function ServicesView() {
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
    image_url: '',
    category: '',
    display_order: 0,
    buffer_before: 0,
    buffer_after: 0,
    no_show_fee: 0,
    late_cancel_fee: 0,
    late_cancel_hours: 24,
  });
  const [serviceDurations, setServiceDurations] = useState<Array<{ duration_minutes: number; price_cents: number }>>([
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
        alert(`You've reached the maximum number of services (${limits.maxServices}) for your ${premiumFeatures.planType.toUpperCase()} plan. Upgrade to Pro for unlimited services.`);
        return;
      }
    }

    setEditingService(null);
    setFormData({
      name: '',
      description: '',
      is_pair_massage: false,
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
        duration_minutes: d.duration_minutes,
        price_cents: d.price_cents,
      })) || [{ duration_minutes: 60, price_cents: 8900 }]
    );
    setIsCreatingNewCategory(false);
    setNewCategoryName('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const categoryToSave = isCreatingNewCategory ? newCategoryName.trim() : formData.category;

    if (!categoryToSave) {
      alert('Please select or create a category');
      return;
    }

    try {
      if (!tenant.businessId) {
        alert('Business not found');
        return;
      }

      if (editingService) {
        const { error: updateError } = await supabase
          .from('services')
          .update({
            name: formData.name,
            description: formData.description,
            is_pair_massage: formData.is_pair_massage,
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
          alert('Failed to update service: ' + updateError.message);
          return;
        }

        const { error: deleteError } = await supabase
          .from('service_durations')
          .delete()
          .eq('service_id', editingService.id);

        if (deleteError) {
          console.error('Error deleting durations:', deleteError);
        }

        for (const duration of serviceDurations) {
          const { error: durationError } = await supabase.from('service_durations').insert({
            business_id: tenant.businessId,
            service_id: editingService.id,
            duration_minutes: duration.duration_minutes,
            price_cents: duration.price_cents,
          });

          if (durationError) {
            console.error('Error inserting duration:', durationError);
          }
        }
      } else {
        const { data: newService, error: insertError } = await supabase
          .from('services')
          .insert({
            business_id: tenant.businessId,
            name: formData.name,
            description: formData.description,
            is_pair_massage: formData.is_pair_massage,
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
          alert('Failed to create service: ' + insertError.message);
          return;
        }

        if (newService) {
          for (const duration of serviceDurations) {
            const { error: durationError } = await supabase.from('service_durations').insert({
              business_id: tenant.businessId,
              service_id: newService.id,
              duration_minutes: duration.duration_minutes,
              price_cents: duration.price_cents,
            });

            if (durationError) {
              console.error('Error inserting duration:', durationError);
            }
          }
        }
      }

      setShowModal(false);
      await fetchServices();
    } catch (error) {
      console.error('Error saving service:', error);
      alert('An unexpected error occurred. Please check the console for details.');
    }
  };

  const deleteService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    if (!tenant.businessId) return;

    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', serviceId)
      .eq('business_id', tenant.businessId);

    if (!error) {
      fetchServices();
    }
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

  const formatPrice = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
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
      const cat = service.category || 'Uncategorized';
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Services</h1>
          <p className="text-gray-600">Manage massage services and pricing</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008374] focus:border-transparent transition-all"
          >
            <option value="all">All Categories</option>
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
              title="List view"
            >
              <LayoutList className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              title="Grid view"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
            title="Import services from CSV"
          >
            <Upload className="w-5 h-5" />
            <span className="font-medium">Import</span>
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center space-x-2 px-5 py-2.5 bg-[#008374] text-white rounded-lg hover:bg-[#006d5f] transition-all shadow-sm hover:shadow-md"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Add Service</span>
          </button>
        </div>
      </div>

      {selectedCategory === 'all' ? (
        <div className="space-y-8">
          {Object.entries(getServicesByCategory()).map(([category, categoryServices]) => (
            <div key={category} className="space-y-4">
              <button
                onClick={() => toggleCategory(category)}
                className="flex items-center justify-between w-full p-5 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-all border-l-4 border-[#008374] rounded-r-lg shadow-sm"
              >
                <div className="flex items-center space-x-3">
                  <h2 className="text-xl font-semibold text-gray-900">{category}</h2>
                  <span className="text-sm px-3 py-1 bg-white rounded-full text-gray-600 font-medium shadow-sm">
                    {categoryServices.length} {categoryServices.length === 1 ? 'service' : 'services'}
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
                            ? 'border-[#008374] border-2 shadow-xl scale-105'
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {service.name}
                    {service.is_pair_massage && (
                      <span className="ml-2 text-xs px-3 py-1 bg-[#008374] bg-opacity-10 text-[#008374] rounded-full font-medium">
                        Couples Available
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{service.description}</p>
                </div>
              </div>
              <div className="flex space-x-2 ml-4">
                <button
                  onClick={() => openEditModal(service)}
                  className="p-2 text-gray-500 hover:text-[#008374] hover:bg-gray-100 rounded-lg transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteService(service.id)}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Durations & Pricing</p>
              {durations[service.id]?.map((duration) => (
                <div key={duration.id} className="flex justify-between items-center text-sm py-2.5 px-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <span className="text-gray-700 font-medium">{duration.duration_minutes} min</span>
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
                    <span className="text-sm">No image</span>
                  </div>
                )}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
                  <button
                    onClick={() => openEditModal(service)}
                    className="p-2 bg-white rounded shadow-lg text-stone-600 hover:text-stone-800"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteService(service.id)}
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
                  {service.is_pair_massage && (
                    <span className="ml-2 text-xs px-2 py-0.5 bg-stone-200 text-stone-700 rounded-full">
                      Couples
                    </span>
                  )}
                </h3>
                <p className="text-sm text-stone-600 mb-3 line-clamp-2">{service.description}</p>
                <div className="space-y-1">
                  {durations[service.id]?.map((duration) => (
                    <div key={duration.id} className="flex justify-between text-xs">
                      <span className="text-stone-600">{duration.duration_minutes}min</span>
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
                    onDragStart={() => handleDragStart(service)}
                    onDragOver={(e) => handleDragOver(e, service)}
                    onDragLeave={handleDragLeave}
                    onDrop={() => handleDrop(service)}
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
                            {service.is_pair_massage && (
                              <span className="ml-2 text-xs px-2 py-1 bg-stone-200 text-stone-700 rounded-full">
                                Couples Available
                              </span>
                            )}
                          </h3>
                          <p className="text-sm text-stone-600">{service.description}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => openEditModal(service)}
                          className="text-stone-600 hover:text-stone-800"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteService(service.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-stone-700 uppercase tracking-wider">Durations & Pricing</p>
                      {durations[service.id]?.map((duration) => (
                        <div key={duration.id} className="flex justify-between text-sm py-2 border-t border-stone-100">
                          <span className="text-stone-600">{duration.duration_minutes} minutes</span>
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
                    onDragStart={() => handleDragStart(service)}
                    onDragOver={(e) => handleDragOver(e, service)}
                    onDragLeave={handleDragLeave}
                    onDrop={() => handleDrop(service)}
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
                          <span className="text-sm">No image</span>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
                        <button
                          onClick={() => openEditModal(service)}
                          className="p-2 bg-white rounded shadow-lg text-stone-600 hover:text-stone-800"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteService(service.id)}
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
                        {service.is_pair_massage && (
                          <span className="ml-2 text-xs px-2 py-0.5 bg-stone-200 text-stone-700 rounded-full">
                            Couples
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-stone-600 mb-3 line-clamp-2">{service.description}</p>
                      <div className="space-y-1">
                        {durations[service.id]?.map((duration) => (
                          <div key={duration.id} className="flex justify-between text-xs">
                            <span className="text-stone-600">{duration.duration_minutes}min</span>
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
              <h2 className="text-2xl font-light text-stone-800">
                {editingService ? 'Edit Service' : 'New Service'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Service Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Description</label>
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
                  <label className="block text-sm font-medium text-stone-700 mb-2">Category</label>
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
                        <option value="">Select a category...</option>
                        {existingCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                        <option value="__create_new__">+ Create New Category</option>
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
                        placeholder="Enter new category name"
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
                        ← Back to existing categories
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Image URL (Optional)</label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
                  placeholder="https://example.com/image.jpg"
                />
                <p className="text-xs text-stone-500 mt-1">
                  Recommended: Use free stock photos from{' '}
                  <a
                    href="https://www.pexels.com/search/massage/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-700 hover:underline"
                  >
                    Pexels
                  </a>
                  {' '}or{' '}
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
                      alt="Preview"
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
                  <span className="text-sm text-stone-700">Available for couples</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Buffer Before (minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.buffer_before}
                    onChange={(e) => setFormData({ ...formData, buffer_before: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
                  />
                  <p className="text-xs text-stone-500 mt-1">Setup/preparation time before service</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Buffer After (minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.buffer_after}
                    onChange={(e) => setFormData({ ...formData, buffer_after: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
                  />
                  <p className="text-xs text-stone-500 mt-1">Cleanup/transition time after service</p>
                </div>
              </div>

              <div className="border-t border-stone-200 pt-6">
                <h3 className="text-sm font-medium text-stone-700 mb-4">No-Show & Cancellation Fees</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">
                      No-Show Fee (€)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.no_show_fee / 100}
                      onChange={(e) => setFormData({ ...formData, no_show_fee: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                      className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
                    />
                    <p className="text-xs text-stone-500 mt-1">Fee for missed appointments</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">
                      Late Cancel Fee (€)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.late_cancel_fee / 100}
                      onChange={(e) => setFormData({ ...formData, late_cancel_fee: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                      className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
                    />
                    <p className="text-xs text-stone-500 mt-1">Fee for late cancellations</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">
                      Cancel Before (hours)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.late_cancel_hours}
                      onChange={(e) => setFormData({ ...formData, late_cancel_hours: parseInt(e.target.value) || 24 })}
                      className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
                    />
                    <p className="text-xs text-stone-500 mt-1">Hours notice required</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-stone-700">Durations & Prices</label>
                  <button
                    type="button"
                    onClick={addDuration}
                    className="text-sm text-stone-600 hover:text-stone-800 flex items-center space-x-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Duration</span>
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
                        placeholder="Duration (minutes)"
                        min="15"
                        step="15"
                        required
                      />
                      <input
                        type="number"
                        value={duration.price_cents / 100}
                        onChange={(e) => updateDuration(index, 'price_cents', Math.round(parseFloat(e.target.value) * 100))}
                        className="flex-1 px-4 py-2 border border-stone-200 focus:outline-none focus:border-stone-800"
                        placeholder="Price (€)"
                        min="0"
                        step="0.01"
                        required
                      />
                      {serviceDurations.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDuration(index)}
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
                  {editingService ? 'Update Service' : 'Create Service'}
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
