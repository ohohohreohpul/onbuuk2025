import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, X, Package, LayoutList, LayoutGrid, ChevronDown, ChevronRight, GripVertical, Image } from 'lucide-react';
import { useTenant } from '../../lib/tenantContext';
import { useCurrency } from '../../lib/currencyContext';

interface Product {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  image_url: string | null;
  is_active: boolean;
  display_order: number;
  max_quantity_per_booking: number | null;
  category: string | null;
}

interface Service {
  id: string;
  name: string;
}

export default function ProductsView() {
  const { businessId } = useTenant();
  const { formatAmount } = useCurrency();
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
    category: '',
  });
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [isAvailableForAll, setIsAvailableForAll] = useState(true);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [uploadingImage, setUploadingImage] = useState(false);

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
      .order('category')
      .order('display_order')
      .order('name');

    if (data) {
      setProducts(data);
      
      // Extract unique categories
      const categories = data
        .map(p => p.category)
        .filter((cat): cat is string => cat !== null && cat !== '')
        .filter((cat, index, self) => self.indexOf(cat) === index)
        .sort();
      setExistingCategories(categories);
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
      category: '',
    });
    setSelectedServices([]);
    setIsAvailableForAll(true);
    setIsCreatingNewCategory(false);
    setNewCategoryName('');
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
      category: product.category || '',
    });
    setIsCreatingNewCategory(false);
    setNewCategoryName('');

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !businessId) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB');
      return;
    }

    setUploadingImage(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${businessId}/products/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('business-assets')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('business-assets')
        .getPublicUrl(fileName);

      setFormData({ ...formData, image_url: publicUrl });
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;

    const categoryToSave = isCreatingNewCategory ? newCategoryName : formData.category;

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
            category: categoryToSave || null,
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
            category: categoryToSave || null,
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

  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // Group products by category
  const groupedProducts = products.reduce((acc, product) => {
    const category = product.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(p => (p.category || 'Uncategorized') === selectedCategory);

  const allCategories = ['all', ...Object.keys(groupedProducts).sort()];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800 mb-1">Add-On Products</h1>
          <p className="text-stone-500 text-sm">Manage products that can be added to bookings</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center space-x-2 px-5 py-2.5 bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      {/* Filters & View Toggle */}
      <div className="flex items-center justify-between bg-white border border-stone-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 overflow-x-auto">
          {allCategories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? 'bg-stone-800 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {category === 'all' ? 'All Products' : category}
              {category !== 'all' && (
                <span className="ml-2 text-xs opacity-70">
                  ({groupedProducts[category]?.length || 0})
                </span>
              )}
            </button>
          ))}
        </div>
        
        <div className="flex items-center space-x-2 ml-4">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            <LayoutList className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Products List/Grid */}
      {viewMode === 'list' ? (
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          {selectedCategory === 'all' ? (
            // Grouped by category
            Object.entries(groupedProducts).sort(([a], [b]) => a.localeCompare(b)).map(([category, categoryProducts]) => (
              <div key={category}>
                <button
                  onClick={() => toggleCategoryCollapse(category)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-stone-50 border-b border-stone-200 hover:bg-stone-100 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    {collapsedCategories.has(category) ? (
                      <ChevronRight className="w-4 h-4 text-stone-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-stone-400" />
                    )}
                    <span className="font-medium text-stone-700">{category}</span>
                    <span className="text-xs text-stone-500">({categoryProducts.length})</span>
                  </div>
                </button>
                
                {!collapsedCategories.has(category) && (
                  <div>
                    {categoryProducts.map((product) => (
                      <ProductListItem
                        key={product.id}
                        product={product}
                        formatAmount={formatAmount}
                        onEdit={() => openEditModal(product)}
                        onDelete={() => deleteProduct(product.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            // Flat list for filtered view
            filteredProducts.map((product) => (
              <ProductListItem
                key={product.id}
                product={product}
                formatAmount={formatAmount}
                onEdit={() => openEditModal(product)}
                onDelete={() => deleteProduct(product.id)}
              />
            ))
          )}
          
          {products.length === 0 && (
            <div className="text-center py-12 text-stone-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-stone-300" />
              <p className="font-medium">No products yet</p>
              <p className="text-sm">Create your first add-on product!</p>
            </div>
          )}
        </div>
      ) : (
        // Grid View
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white border border-stone-200 rounded-lg overflow-hidden hover:border-stone-300 hover:shadow-md transition-all"
            >
              <div className="aspect-video bg-stone-100 flex items-center justify-center">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-12 h-12 text-stone-300" />
                )}
              </div>
              <div className="p-4">
                {product.category && (
                  <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">{product.category}</span>
                )}
                <h3 className="text-lg font-medium text-stone-800 mt-1">{product.name}</h3>
                <p className="text-sm text-stone-500 line-clamp-2 mt-1">{product.description}</p>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-stone-100">
                  <span className="text-lg font-semibold text-stone-800">{formatAmount(product.price_cents / 100)}</span>
                  <div className="flex items-center space-x-1">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        product.is_active ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {product.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={() => openEditModal(product)}
                      className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteProduct(product.id)}
                      className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {filteredProducts.length === 0 && (
            <div className="col-span-full text-center py-12 text-stone-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-stone-300" />
              <p className="font-medium">No products in this category</p>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-xl shadow-xl">
            <div className="p-6 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-white rounded-t-xl">
              <h2 className="text-xl font-semibold text-stone-800">
                {editingProduct ? 'Edit Product' : 'New Product'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Category</label>
                {!isCreatingNewCategory ? (
                  <div className="space-y-2">
                    <select
                      value={formData.category}
                      onChange={(e) => {
                        if (e.target.value === '__new__') {
                          setIsCreatingNewCategory(true);
                        } else {
                          setFormData({ ...formData, category: e.target.value });
                        }
                      }}
                      className="w-full px-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-800 focus:border-transparent"
                    >
                      <option value="">No Category</option>
                      {existingCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__new__">+ Create New Category</option>
                    </select>
                  </div>
                ) : (
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Enter new category name"
                      className="flex-1 px-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-800 focus:border-transparent"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingNewCategory(false);
                        setNewCategoryName('');
                      }}
                      className="px-4 py-2.5 border border-stone-200 text-stone-600 rounded-lg hover:bg-stone-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Product Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-800 focus:border-transparent"
                  placeholder="e.g., Aromatherapy Oil"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-800 focus:border-transparent resize-none"
                  placeholder="Describe your product..."
                  required
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price_cents / 100}
                  onChange={(e) =>
                    setFormData({ ...formData, price_cents: Math.round(parseFloat(e.target.value) * 100) || 0 })
                  }
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-800 focus:border-transparent"
                  required
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Product Image</label>
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    {formData.image_url ? (
                      <div className="w-24 h-24 border border-stone-200 rounded-lg overflow-hidden">
                        <img src={formData.image_url} alt="Product" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-24 h-24 border border-dashed border-stone-300 rounded-lg flex items-center justify-center bg-stone-50">
                        <Package className="w-8 h-8 text-stone-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                      <span className="inline-flex items-center px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50 cursor-pointer transition-colors">
                        <Image className="w-4 h-4 mr-2" />
                        {uploadingImage ? 'Uploading...' : 'Upload Image'}
                      </span>
                    </label>
                    {formData.image_url && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, image_url: '' })}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove image
                      </button>
                    )}
                    <p className="text-xs text-stone-500">Max 2MB. JPG, PNG or WebP recommended.</p>
                  </div>
                </div>
              </div>

              {/* Max Quantity */}
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
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-800 focus:border-transparent"
                  placeholder="Leave empty for unlimited"
                />
                <p className="text-xs text-stone-500 mt-1">
                  How many times can this be added per booking?
                </p>
              </div>

              {/* Active Status */}
              <div className="flex items-center justify-between p-4 bg-stone-50 rounded-lg">
                <div>
                  <p className="font-medium text-stone-700">Product Status</p>
                  <p className="text-sm text-stone-500">Inactive products won't be shown to customers</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-stone-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>

              {/* Service Availability */}
              <div className="border-t border-stone-200 pt-5">
                <h3 className="text-sm font-medium text-stone-700 mb-3">Available For</h3>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 p-3 border border-stone-200 rounded-lg cursor-pointer hover:bg-stone-50 transition-colors">
                    <input
                      type="radio"
                      checked={isAvailableForAll}
                      onChange={() => setIsAvailableForAll(true)}
                      className="w-4 h-4 text-stone-800"
                    />
                    <div>
                      <p className="font-medium text-stone-700">All Services</p>
                      <p className="text-xs text-stone-500">This product will be available for all services</p>
                    </div>
                  </label>
                  <label className="flex items-center space-x-3 p-3 border border-stone-200 rounded-lg cursor-pointer hover:bg-stone-50 transition-colors">
                    <input
                      type="radio"
                      checked={!isAvailableForAll}
                      onChange={() => setIsAvailableForAll(false)}
                      className="w-4 h-4 text-stone-800"
                    />
                    <div>
                      <p className="font-medium text-stone-700">Specific Services</p>
                      <p className="text-xs text-stone-500">Choose which services can offer this product</p>
                    </div>
                  </label>

                  {!isAvailableForAll && (
                    <div className="ml-7 space-y-2 mt-3 max-h-48 overflow-y-auto border border-stone-200 rounded-lg p-3">
                      {services.map((service) => (
                        <label key={service.id} className="flex items-center space-x-2 p-2 hover:bg-stone-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedServices.includes(service.id)}
                            onChange={() => toggleServiceSelection(service.id)}
                            className="w-4 h-4 text-stone-800 rounded"
                          />
                          <span className="text-sm text-stone-700">{service.name}</span>
                        </label>
                      ))}
                      {services.length === 0 && (
                        <p className="text-sm text-stone-500 text-center py-2">No services available</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-4 border-t border-stone-200">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors font-medium"
                >
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors"
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

// Product List Item Component
function ProductListItem({ 
  product, 
  formatAmount, 
  onEdit, 
  onDelete 
}: { 
  product: Product; 
  formatAmount: (amount: number) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center px-4 py-3 border-b border-stone-100 hover:bg-stone-50 transition-colors group">
      <div className="flex-shrink-0 w-12 h-12 bg-stone-100 rounded-lg overflow-hidden mr-4">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-5 h-5 text-stone-300" />
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-stone-800 truncate">{product.name}</h3>
        <p className="text-sm text-stone-500 truncate">{product.description}</p>
      </div>
      
      <div className="flex items-center space-x-4 ml-4">
        <span className="font-semibold text-stone-800 whitespace-nowrap">
          {formatAmount(product.price_cents / 100)}
        </span>
        <span
          className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
            product.is_active ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'
          }`}
        >
          {product.is_active ? 'Active' : 'Inactive'}
        </span>
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
