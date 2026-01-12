import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronRight, Plus, Minus, Package, Check } from 'lucide-react';
import { useTenant } from '../lib/tenantContext';
import { useBookingCustomization } from '../hooks/useBookingCustomization';

interface Product {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  image_url: string | null;
  max_quantity_per_booking: number | null;
  category: string | null;
  is_exclusive_in_category: boolean;
}

interface SelectedProduct {
  product: Product;
  quantity: number;
}

interface AddOnsStepProps {
  serviceId: string;
  onNext: (selectedProducts: SelectedProduct[]) => void;
  onBack: () => void;
}

export default function AddOnsStep({ serviceId, onNext, onBack }: AddOnsStepProps) {
  const { businessId } = useTenant();
  const { customization } = useBookingCustomization();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  const content = {
    title: customization?.addons_step?.title || 'Add-On Products',
    subtitle: customization?.addons_step?.subtitle || 'Enhance your experience with optional add-ons',
    buttonText: customization?.addons_step?.buttonText || 'Continue',
    skipButtonText: customization?.addons_step?.skipButtonText || 'Continue Without Add-Ons'
  };

  useEffect(() => {
    if (businessId && serviceId) {
      fetchProducts();
    }
  }, [businessId, serviceId]);

  const fetchProducts = async () => {
    if (!businessId) return;

    const { data: assignments } = await supabase
      .from('product_service_assignments')
      .select('product_id, service_id')
      .eq('business_id', businessId)
      .or(`service_id.eq.${serviceId},service_id.is.null`);

    if (!assignments || assignments.length === 0) {
      setLoading(false);
      return;
    }

    const productIds = assignments.map((a) => a.product_id);

    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds)
      .eq('is_active', true)
      .eq('business_id', businessId)
      .order('category')
      .order('display_order')
      .order('name');

    if (productsData) {
      setProducts(productsData);
    }

    setLoading(false);
  };

  // Check if a product belongs to an exclusive category
  const isExclusiveCategory = (product: Product) => {
    return product.is_exclusive_in_category && product.category;
  };

  // Get all products in the same exclusive category
  const getExclusiveCategoryProducts = (category: string | null) => {
    if (!category) return [];
    return products.filter(p => p.category === category && p.is_exclusive_in_category);
  };

  const updateQuantity = (productId: string, change: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const maxQty = product.max_quantity_per_booking;

    setSelectedProducts((prev) => {
      const newMap = new Map(prev);
      const currentQty = newMap.get(productId) || 0;
      let newQty = Math.max(0, currentQty + change);

      if (maxQty !== null && maxQty !== undefined) {
        newQty = Math.min(newQty, maxQty);
      }

      // Handle exclusive category selection
      if (isExclusiveCategory(product) && newQty > 0) {
        // Remove all other products from the same exclusive category
        const exclusiveProducts = getExclusiveCategoryProducts(product.category);
        exclusiveProducts.forEach(ep => {
          if (ep.id !== productId) {
            newMap.delete(ep.id);
          }
        });
      }

      if (newQty === 0) {
        newMap.delete(productId);
      } else {
        newMap.set(productId, newQty);
      }

      return newMap;
    });
  };

  // For exclusive category products, select/deselect like a radio button
  const toggleExclusiveProduct = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    setSelectedProducts((prev) => {
      const newMap = new Map(prev);
      const isCurrentlySelected = newMap.has(productId);

      // Remove all products from the same exclusive category
      const exclusiveProducts = getExclusiveCategoryProducts(product.category);
      exclusiveProducts.forEach(ep => {
        newMap.delete(ep.id);
      });

      // If it wasn't selected, select it now
      if (!isCurrentlySelected) {
        newMap.set(productId, 1);
      }

      return newMap;
    });
  };

  const handleContinue = () => {
    const selected: SelectedProduct[] = [];

    selectedProducts.forEach((quantity, productId) => {
      const product = products.find((p) => p.id === productId);
      if (product) {
        selected.push({ product, quantity });
      }
    });

    onNext(selected);
  };

  const getTotalPrice = () => {
    let total = 0;
    selectedProducts.forEach((quantity, productId) => {
      const product = products.find((p) => p.id === productId);
      if (product) {
        total += product.price_cents * quantity;
      }
    });
    return total;
  };

  const formatPrice = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  // Group products by category for exclusive handling
  const groupedProducts = products.reduce((acc, product) => {
    const category = product.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  // Check if a category has exclusive products
  const categoryHasExclusiveProducts = (category: string) => {
    return groupedProducts[category]?.some(p => p.is_exclusive_in_category) || false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-[#008374] animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col max-h-full">
      <div className="flex-shrink-0 mb-4">
        <button
          onClick={onBack}
          className="text-gray-600 hover:text-black text-sm mb-4 inline-flex items-center transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
          Back
        </button>
        <h2 className="text-3xl font-light text-custom-primary mb-2">{content.title}</h2>
        <p className="text-custom-secondary">{content.subtitle}</p>
      </div>

      {products.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No add-on products available for this service</p>
            <button
              onClick={() => onNext([])}
              className="mt-6 px-8 py-3 bg-custom-primary text-white hover:bg-custom transition-colors"
            >
              {content.skipButtonText}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto min-h-0 space-y-6 mb-4">
            {Object.entries(groupedProducts).map(([category, categoryProducts]) => {
              const hasExclusive = categoryHasExclusiveProducts(category);
              
              return (
                <div key={category} className="space-y-3">
                  {/* Category Header */}
                  {category !== 'Other' && (
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">{category}</h3>
                      {hasExclusive && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                          Select one
                        </span>
                      )}
                    </div>
                  )}

                  {/* Products in Category */}
                  {categoryProducts.map((product) => {
                    const quantity = selectedProducts.get(product.id) || 0;
                    const maxQty = product.max_quantity_per_booking;
                    const isAtMax = maxQty !== null && maxQty !== undefined && quantity >= maxQty;
                    const isExclusive = isExclusiveCategory(product);
                    const isSelected = quantity > 0;

                    return (
                      <div 
                        key={product.id} 
                        className={`bg-white border p-5 transition-all ${
                          isSelected ? 'border-[#008374] bg-[#008374]/5' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start space-x-4">
                          {/* Image - only show if there is one */}
                          {product.image_url && (
                            <div className="w-20 h-20 flex-shrink-0 bg-gray-100 overflow-hidden">
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}

                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h3 className="text-lg font-medium text-black">{product.name}</h3>
                                <p className="text-sm text-gray-600 mt-1">{product.description}</p>
                                {maxQty && !isExclusive && (
                                  <p className="text-xs text-gray-500 mt-1">Max {maxQty} per booking</p>
                                )}
                              </div>
                              <span className="text-lg font-medium text-black ml-4">
                                {formatPrice(product.price_cents)}
                              </span>
                            </div>

                            {/* Selection Controls */}
                            <div className="flex items-center mt-3">
                              {isExclusive ? (
                                // Radio-style selection for exclusive category products
                                <button
                                  onClick={() => toggleExclusiveProduct(product.id)}
                                  className={`flex items-center space-x-2 px-4 py-2 border transition-colors ${
                                    isSelected 
                                      ? 'border-[#008374] bg-[#008374] text-white' 
                                      : 'border-gray-300 hover:border-[#008374] text-gray-700'
                                  }`}
                                >
                                  {isSelected && <Check className="w-4 h-4" />}
                                  <span>{isSelected ? 'Selected' : 'Select'}</span>
                                </button>
                              ) : (
                                // Quantity controls for regular products
                                <div className="flex items-center space-x-3">
                                  <button
                                    onClick={() => updateQuantity(product.id, -1)}
                                    disabled={quantity === 0}
                                    className="w-8 h-8 flex items-center justify-center border border-gray-300 hover:border-custom-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  >
                                    <Minus className="w-4 h-4 text-gray-600" />
                                  </button>
                                  <span className="text-black font-medium w-8 text-center">{quantity}</span>
                                  <button
                                    onClick={() => updateQuantity(product.id, 1)}
                                    disabled={isAtMax}
                                    className="w-8 h-8 flex items-center justify-center border border-gray-300 hover:border-custom-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  >
                                    <Plus className="w-4 h-4 text-gray-600" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="flex-shrink-0 space-y-4">
            {selectedProducts.size > 0 && (
              <div className="p-4 bg-[#f9f9f9] border border-gray-200">
                <div className="flex items-center justify-between text-lg">
                  <span className="text-gray-700">Add-Ons Total:</span>
                  <span className="font-medium text-black">{formatPrice(getTotalPrice())}</span>
                </div>
              </div>
            )}

            <button
              onClick={handleContinue}
              className="w-full px-8 py-4 bg-custom-primary text-white hover:bg-custom transition-colors text-lg"
            >
              {content.buttonText}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
