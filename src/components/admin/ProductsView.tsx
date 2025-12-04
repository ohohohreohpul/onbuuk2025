import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, X, Package } from 'lucide-react';
import { useTenant } from '../../lib/tenantContext';

interface Product {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  image_url: string | null;
  is_active: boolean;
  display_order: number;
  max_quantity_per_booking: number | null;
}

interface Service {
  id: string;
  name: string;
}

export default function ProductsView() {
  const { businessId } = useTenant();
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_cents: 0,
    image_url: '',
    is_active: true,
    max_quantity_per_booking: 1,
  });
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [isAvailableForAll, setIsAvailableForAll] = useState(true);

  useEffect(() => {
    if (businessId) {
      fetchProducts();
      fetchServices();
    }
  }, [businessId]);

  const fetchProducts = async () => {
    if (!businessId) return;

    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .order('display_order')
      .order('name');

    if (data) {
      setProducts(data);
    }
    setLoading(false);
  };

  const fetchServices = async () => {
    if (!businessId) return;

    const { data } = await supabase
      .from('services')
      .select('id, name')
      .eq('business_id', businessId)
      .order('name');

    if (data) {
      setServices(data);
    }
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      price_cents: 0,
      image_url: '',
      is_active: true,
      max_quantity_per_booking: 1,
    });
    setSelectedServices([]);
    setIsAvailableForAll(true);
    setShowModal(true);
  };

  const openEditModal = async (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price_cents: product.price_cents,
      image_url: product.image_url || '',
      is_active: product.is_active,
      max_quantity_per_booking: product.max_quantity_per_booking ?? 1,
    });

    const { data: assignments } = await supabase
      .from('product_service_assignments')
      .select('service_id')
      .eq('product_id', product.id);

    if (assignments && assignments.length > 0) {
      const hasNullService = assignments.some((a) => a.service_id === null);
      if (hasNullService) {
        setIsAvailableForAll(true);
        setSelectedServices([]);
      } else {
        setIsAvailableForAll(false);
        setSelectedServices(assignments.map((a) => a.service_id).filter((id): id is string => id !== null));
      }
    } else {
      setIsAvailableForAll(true);
      setSelectedServices([]);
    }

    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;

    try {
      if (editingProduct) {
        const { error: updateError } = await supabase
          .from('products')
          .update({
            name: formData.name,
            description: formData.description,
            price_cents: formData.price_cents,
            image_url: formData.image_url || null,
            is_active: formData.is_active,
            max_quantity_per_booking: formData.max_quantity_per_booking || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingProduct.id);

        if (updateError) throw updateError;

        await supabase
          .from('product_service_assignments')
          .delete()
          .eq('product_id', editingProduct.id);

        if (isAvailableForAll) {
          await supabase.from('product_service_assignments').insert({
            product_id: editingProduct.id,
            service_id: null,
            business_id: businessId,
          });
        } else {
          const assignments = selectedServices.map((serviceId) => ({
            product_id: editingProduct.id,
            service_id: serviceId,
            business_id: businessId,
          }));
          await supabase.from('product_service_assignments').insert(assignments);
        }
      } else {
        const { data: newProduct, error: insertError } = await supabase
          .from('products')
          .insert({
            business_id: businessId,
            name: formData.name,
            description: formData.description,
            price_cents: formData.price_cents,
            image_url: formData.image_url || null,
            is_active: formData.is_active,
            max_quantity_per_booking: formData.max_quantity_per_booking || null,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        if (newProduct) {
          if (isAvailableForAll) {
            await supabase.from('product_service_assignments').insert({
              product_id: newProduct.id,
              service_id: null,
              business_id: businessId,
            });
          } else {
            const assignments = selectedServices.map((serviceId) => ({
              product_id: newProduct.id,
              service_id: serviceId,
              business_id: businessId,
            }));
            await supabase.from('product_service_assignments').insert(assignments);
          }
        }
      }

      setShowModal(false);
      await fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('An error occurred while saving the product.');
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    const { error } = await supabase.from('products').delete().eq('id', productId);

    if (!error) {
      fetchProducts();
    }
  };

  const toggleServiceSelection = (serviceId: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light text-stone-800 mb-2">Add-On Products</h1>
          <p className="text-stone-600">Manage products that can be added to services</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center space-x-2 px-6 py-3 bg-stone-800 text-white hover:bg-stone-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add Product</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <div
            key={product.id}
            className="bg-white border border-stone-200 overflow-hidden hover:border-stone-400 transition-colors"
          >
            <div className="aspect-video bg-stone-100 flex items-center justify-center">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <Package className="w-12 h-12 text-stone-400" />
              )}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-stone-800 mb-1">{product.name}</h3>
                  <p className="text-sm text-stone-600 line-clamp-2">{product.description}</p>
                </div>
                <div className="flex space-x-2 ml-2">
                  <button
                    onClick={() => openEditModal(product)}
                    className="text-stone-600 hover:text-stone-800"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteProduct(product.id)} className="text-red-600 hover:text-red-800">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-200">
                <span className="text-lg font-medium text-stone-800">{formatPrice(product.price_cents)}</span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    product.is_active ? 'bg-green-100 text-green-800' : 'bg-stone-200 text-stone-600'
                  }`}
                >
                  {product.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {products.length === 0 && (
        <div className="text-center py-12 text-stone-500">
          <Package className="w-12 h-12 mx-auto mb-3 text-stone-400" />
          <p>No products yet. Create your first add-on product!</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-light text-stone-800">
                {editingProduct ? 'Edit Product' : 'New Product'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Product Name</label>
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

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Price (€)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price_cents / 100}
                  onChange={(e) =>
                    setFormData({ ...formData, price_cents: Math.round(parseFloat(e.target.value) * 100) || 0 })
                  }
                  className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Image URL (optional)</label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Maximum Quantity Per Booking
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.max_quantity_per_booking || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_quantity_per_booking: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
                  placeholder="Leave empty for unlimited"
                />
                <p className="text-xs text-stone-500 mt-1">
                  How many times can this be added per booking? (e.g., 1 for single-use extras)
                </p>
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-stone-800 focus:ring-stone-500"
                  />
                  <span className="text-sm text-stone-700">Product is active</span>
                </label>
              </div>

              <div className="border-t border-stone-200 pt-6">
                <h3 className="text-sm font-medium text-stone-700 mb-4">Available For</h3>
                <div className="space-y-3">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      checked={isAvailableForAll}
                      onChange={() => setIsAvailableForAll(true)}
                      className="w-4 h-4 text-stone-800"
                    />
                    <span className="text-sm text-stone-700">All Services</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      checked={!isAvailableForAll}
                      onChange={() => setIsAvailableForAll(false)}
                      className="w-4 h-4 text-stone-800"
                    />
                    <span className="text-sm text-stone-700">Specific Services</span>
                  </label>

                  {!isAvailableForAll && (
                    <div className="ml-6 space-y-2 mt-3 max-h-48 overflow-y-auto">
                      {services.map((service) => (
                        <label key={service.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={selectedServices.includes(service.id)}
                            onChange={() => toggleServiceSelection(service.id)}
                            className="w-4 h-4 text-stone-800"
                          />
                          <span className="text-sm text-stone-700">{service.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-stone-800 text-white hover:bg-stone-700 transition-colors"
                >
                  {editingProduct ? 'Update Product' : 'Create Product'}
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
