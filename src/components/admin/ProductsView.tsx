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
    if (!businessId) {
      alert('Business ID not found. Please refresh the page.');
      return;
    }

    const categoryToSave = isCreatingNewCategory ? newCategoryName.trim() : formData.category;

    // Validation
    if (!formData.name.trim()) {
      alert('Please enter a product name.');
      return;
    }
    if (!formData.description.trim()) {
      alert('Please enter a product description.');
      return;
    }

    try {
      if (editingProduct) {
        const { error: updateError } = await supabase
          .from('products')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim(),
            price_cents: formData.price_cents,
            image_url: formData.image_url || null,
            is_active: formData.is_active,
            max_quantity_per_booking: formData.max_quantity_per_booking || null,
            category: categoryToSave || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingProduct.id);

        if (updateError) {
          console.error('Update error:', updateError);
          alert(`Failed to update product: ${updateError.message}`);
          return;
        }

        const { error: deleteError } = await supabase
          .from('product_service_assignments')
          .delete()
          .eq('product_id', editingProduct.id);

        if (deleteError) {
          console.error('Delete assignments error:', deleteError);
        }

        if (isAvailableForAll) {
          const { error: assignError } = await supabase.from('product_service_assignments').insert({
            product_id: editingProduct.id,
            service_id: null,
            business_id: businessId,
          });
          if (assignError) console.error('Assignment error:', assignError);
        } else if (selectedServices.length > 0) {
          const assignments = selectedServices.map((serviceId) => ({
            product_id: editingProduct.id,
            service_id: serviceId,
            business_id: businessId,
          }));
          const { error: assignError } = await supabase.from('product_service_assignments').insert(assignments);
          if (assignError) console.error('Assignment error:', assignError);
        }
      } else {
        const { data: newProduct, error: insertError } = await supabase
          .from('products')
          .insert({
            business_id: businessId,
            name: formData.name.trim(),
            description: formData.description.trim(),
            price_cents: formData.price_cents,
            image_url: formData.image_url || null,
            is_active: formData.is_active,
            max_quantity_per_booking: formData.max_quantity_per_booking || null,
            category: categoryToSave || null,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Insert error:', insertError);
          alert(`Failed to create product: ${insertError.message}`);
          return;
        }

        if (newProduct) {
          if (isAvailableForAll) {
            const { error: assignError } = await supabase.from('product_service_assignments').insert({
              product_id: newProduct.id,
              service_id: null,
              business_id: businessId,
            });
            if (assignError) console.error('Assignment error:', assignError);
          } else if (selectedServices.length > 0) {
            const assignments = selectedServices.map((serviceId) => ({
              product_id: newProduct.id,
              service_id: serviceId,
              business_id: businessId,
            }));
            const { error: assignError } = await supabase.from('product_service_assignments').insert(assignments);
            if (assignError) console.error('Assignment error:', assignError);
          }
        }
      }

      setShowModal(false);
      await fetchProducts();
    } catch (error: any) {
      console.error('Error saving product:', error);
      alert(`An error occurred while saving the product: ${error?.message || 'Unknown error'}`);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-[#008374] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - Matches ServicesView */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Add-On Products</h1>
          <p className="text-gray-600">Manage products that can be added to bookings</p>
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
            onClick={openCreateModal}
            className="flex items-center space-x-2 px-5 py-2.5 bg-[#008374] text-white rounded-lg hover:bg-[#006d5f] transition-all shadow-sm hover:shadow-md"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Add Product</span>
          </button>
        </div>
      </div>

      {/* Products Display */}
      {selectedCategory === 'all' ? (
        <div className="space-y-8">
          {Object.entries(groupedProducts).sort(([a], [b]) => a.localeCompare(b)).map(([category, categoryProducts]) => (
            <div key={category} className="space-y-4">
              {/* Category Header - Matches ServicesView */}
              <button
                onClick={() => toggleCategoryCollapse(category)}
                className="flex items-center justify-between w-full p-5 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-all border-l-4 border-[#008374] rounded-r-lg shadow-sm"
              >
                <div className="flex items-center space-x-3">
                  <h2 className="text-xl font-semibold text-gray-900">{category}</h2>
                  <span className="text-sm px-3 py-1 bg-white rounded-full text-gray-600 font-medium shadow-sm">
                    {categoryProducts.length} {categoryProducts.length === 1 ? 'product' : 'products'}
                  </span>
                </div>
                <span className="text-gray-500 text-lg">
                  {collapsedCategories.has(category) ? '▼' : '▲'}
                </span>
              </button>

              {!collapsedCategories.has(category) && (
                viewMode === 'list' ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {categoryProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        formatAmount={formatAmount}
                        onEdit={() => openEditModal(product)}
                        onDelete={() => deleteProduct(product.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {categoryProducts.map((product) => (
                      <ProductGridCard
                        key={product.id}
                        product={product}
                        formatAmount={formatAmount}
                        onEdit={() => openEditModal(product)}
                        onDelete={() => deleteProduct(product.id)}
                      />
                    ))}
                  </div>
                )
              )}
            </div>
          ))}

          {products.length === 0 && (
            <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-xl font-medium text-gray-700 mb-2">No products yet</p>
              <p className="text-gray-500 mb-6">Create your first add-on product!</p>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#008374] text-white rounded-lg hover:bg-[#006d5f] transition-all"
              >
                <Plus className="w-5 h-5" />
                <span>Add Product</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {viewMode === 'list' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  formatAmount={formatAmount}
                  onEdit={() => openEditModal(product)}
                  onDelete={() => deleteProduct(product.id)}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <ProductGridCard
                  key={product.id}
                  product={product}
                  formatAmount={formatAmount}
                  onEdit={() => openEditModal(product)}
                  onDelete={() => deleteProduct(product.id)}
                />
              ))}
            </div>
          )}

          {filteredProducts.length === 0 && (
            <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-xl font-medium text-gray-700">No products in this category</p>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal - Matches ServicesView styling */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-light text-gray-900">
                {editingProduct ? 'Edit Product' : 'New Product'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 focus:outline-none focus:border-[#008374] focus:ring-1 focus:ring-[#008374]"
                  placeholder="e.g., Aromatherapy Oil"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 focus:outline-none focus:border-[#008374] focus:ring-1 focus:ring-[#008374] resize-none"
                  placeholder="Describe your product..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
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
                        className="w-full px-4 py-3 border border-gray-200 focus:outline-none focus:border-[#008374] focus:ring-1 focus:ring-[#008374]"
                      >
                        <option value="">Select a category...</option>
                        {existingCategories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
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
                        className="w-full px-4 py-3 border border-gray-200 focus:outline-none focus:border-[#008374] focus:ring-1 focus:ring-[#008374]"
                        placeholder="Enter new category name"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingNewCategory(false);
                          setNewCategoryName('');
                        }}
                        className="text-sm text-gray-600 hover:text-gray-800"
                      >
                        ← Back to existing categories
                      </button>
                    </div>
                  )}
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price_cents / 100}
                    onChange={(e) =>
                      setFormData({ ...formData, price_cents: Math.round(parseFloat(e.target.value) * 100) || 0 })
                    }
                    className="w-full px-4 py-3 border border-gray-200 focus:outline-none focus:border-[#008374] focus:ring-1 focus:ring-[#008374]"
                    required
                  />
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Image (Optional)</label>
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    {formData.image_url ? (
                      <div className="w-24 h-24 border border-gray-200 overflow-hidden">
                        <img src={formData.image_url} alt="Product" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-24 h-24 border border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                        <Package className="w-8 h-8 text-gray-300" />
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
                      <span className="inline-flex items-center px-4 py-2 border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors">
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
                    <p className="text-xs text-gray-500">Max 2MB. JPG, PNG or WebP recommended.</p>
                  </div>
                </div>
              </div>

              {/* Max Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  className="w-full px-4 py-3 border border-gray-200 focus:outline-none focus:border-[#008374] focus:ring-1 focus:ring-[#008374]"
                  placeholder="Leave empty for unlimited"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How many times can this be added per booking?
                </p>
              </div>

              {/* Active Status */}
              <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200">
                <div>
                  <p className="font-medium text-gray-700">Product Status</p>
                  <p className="text-sm text-gray-500">Inactive products won't be shown to customers</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#008374]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#008374]"></div>
                </label>
              </div>

              {/* Service Availability */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-4">Available For</h3>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 p-3 border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      checked={isAvailableForAll}
                      onChange={() => setIsAvailableForAll(true)}
                      className="w-4 h-4 text-[#008374] focus:ring-[#008374]"
                    />
                    <div>
                      <p className="font-medium text-gray-700">All Services</p>
                      <p className="text-xs text-gray-500">This product will be available for all services</p>
                    </div>
                  </label>
                  <label className="flex items-center space-x-3 p-3 border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      checked={!isAvailableForAll}
                      onChange={() => setIsAvailableForAll(false)}
                      className="w-4 h-4 text-[#008374] focus:ring-[#008374]"
                    />
                    <div>
                      <p className="font-medium text-gray-700">Specific Services</p>
                      <p className="text-xs text-gray-500">Choose which services can offer this product</p>
                    </div>
                  </label>

                  {!isAvailableForAll && (
                    <div className="ml-7 space-y-2 mt-3 max-h-48 overflow-y-auto border border-gray-200 p-3">
                      {services.map((service) => (
                        <label key={service.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedServices.includes(service.id)}
                            onChange={() => toggleServiceSelection(service.id)}
                            className="w-4 h-4 text-[#008374] rounded focus:ring-[#008374]"
                          />
                          <span className="text-sm text-gray-700">{service.name}</span>
                        </label>
                      ))}
                      {services.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-2">No services available</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-[#008374] text-white hover:bg-[#006d5f] transition-colors font-medium"
                >
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
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

// Product Card Component (List View) - Matches ServicesView card style
function ProductCard({ 
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
    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-300 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-3 flex-1">
          <div className="flex-shrink-0 w-14 h-14 bg-gray-100 rounded-lg overflow-hidden">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-6 h-6 text-gray-300" />
              </div>
            )}
          </div>
          <div className="flex-1">
            {product.category && (
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">{product.category}</p>
            )}
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {product.name}
              {!product.is_active && (
                <span className="ml-2 text-xs px-3 py-1 bg-gray-100 text-gray-500 rounded-full font-medium">
                  Inactive
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">{product.description}</p>
          </div>
        </div>
        <div className="flex space-x-2 ml-4">
          <button
            onClick={onEdit}
            className="p-2 text-gray-500 hover:text-[#008374] hover:bg-gray-100 rounded-lg transition-all"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <div className="flex justify-between items-center py-2.5 px-3 bg-gray-50 rounded-lg">
          <span className="text-gray-700 font-medium">Price</span>
          <span className="text-gray-900 font-semibold text-lg">{formatAmount(product.price_cents / 100)}</span>
        </div>
        {product.max_quantity_per_booking && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            Max {product.max_quantity_per_booking} per booking
          </p>
        )}
      </div>
    </div>
  );
}

// Product Grid Card Component
function ProductGridCard({ 
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
    <div className="bg-white border border-gray-200 overflow-hidden transition-all group hover:border-gray-300 hover:shadow-lg rounded-xl">
      <div className="relative aspect-[4/3] bg-gray-100">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Package className="w-12 h-12 text-gray-300" />
          </div>
        )}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
          <button
            onClick={onEdit}
            className="p-2 bg-white rounded-lg shadow-lg text-gray-600 hover:text-[#008374]"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 bg-white rounded-lg shadow-lg text-red-600 hover:text-red-800"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        {!product.is_active && (
          <div className="absolute top-2 left-2">
            <span className="text-xs px-2 py-1 bg-gray-800/70 text-white rounded-full">Inactive</span>
          </div>
        )}
      </div>
      <div className="p-4">
        {product.category && (
          <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">{product.category}</p>
        )}
        <h3 className="text-base font-semibold text-gray-900 mb-1">{product.name}</h3>
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
          <span className="text-lg font-semibold text-gray-900">{formatAmount(product.price_cents / 100)}</span>
          {product.max_quantity_per_booking && (
            <span className="text-xs text-gray-500">Max: {product.max_quantity_per_booking}</span>
          )}
        </div>
      </div>
    </div>
  );
}
