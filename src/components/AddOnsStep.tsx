import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronRight, Plus, Minus, Package } from 'lucide-react';
import { useTenant } from '../lib/tenantContext';

interface Product {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  image_url: string | null;
  max_quantity_per_booking: number | null;
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
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

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
      .order('display_order')
      .order('name');

    if (productsData) {
      setProducts(productsData);
    }

    setLoading(false);
  };

  const updateQuantity = (productId: string, change: number) => {
    const product = products.find((p) => p.id === productId);
    const maxQty = product?.max_quantity_per_booking;

    setSelectedProducts((prev) => {
      const newMap = new Map(prev);
      const currentQty = newMap.get(productId) || 0;
      let newQty = Math.max(0, currentQty + change);

      if (maxQty !== null && maxQty !== undefined) {
        newQty = Math.min(newQty, maxQty);
      }

      if (newQty === 0) {
        newMap.delete(productId);
      } else {
        newMap.set(productId, newQty);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col max-h-full">
      <div className="flex-shrink-0 mb-4">
        <button
          onClick={onBack}
          className="text-stone-500 hover:text-stone-700 text-sm mb-4 inline-flex items-center"
        >
          <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
          Back
        </button>
        <h2 className="text-3xl font-light text-custom-primary mb-2">Add-On Products</h2>
        <p className="text-custom-secondary">Enhance your experience with optional add-ons</p>
      </div>

      {products.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-stone-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-stone-400" />
            <p>No add-on products available for this service</p>
            <button
              onClick={() => onNext([])}
              className="mt-6 px-8 py-3 bg-custom-primary text-white hover:bg-custom transition-colors"
            >
              Continue Without Add-Ons
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 mb-4">
            {products.map((product) => {
              const quantity = selectedProducts.get(product.id) || 0;
              const maxQty = product.max_quantity_per_booking;
              const isAtMax = maxQty !== null && maxQty !== undefined && quantity >= maxQty;

              return (
                <div key={product.id} className="bg-white border border-stone-200 p-5">
                  <div className="flex items-start space-x-4">
                    <div className="w-20 h-20 flex-shrink-0 bg-stone-100 rounded overflow-hidden">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-stone-400" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-lg font-medium text-stone-800">{product.name}</h3>
                          <p className="text-sm text-stone-600 mt-1">{product.description}</p>
                          {maxQty && (
                            <p className="text-xs text-stone-500 mt-1">Max {maxQty} per booking</p>
                          )}
                        </div>
                        <span className="text-lg font-medium text-stone-800 ml-4">
                          {formatPrice(product.price_cents)}
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 mt-3">
                        <button
                          onClick={() => updateQuantity(product.id, -1)}
                          disabled={quantity === 0}
                          className="w-8 h-8 flex items-center justify-center border border-stone-300 hover:border-stone-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Minus className="w-4 h-4 text-stone-600" />
                        </button>
                        <span className="text-stone-800 font-medium w-8 text-center">{quantity}</span>
                        <button
                          onClick={() => updateQuantity(product.id, 1)}
                          disabled={isAtMax}
                          className="w-8 h-8 flex items-center justify-center border border-stone-300 hover:border-stone-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Plus className="w-4 h-4 text-stone-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex-shrink-0 space-y-4">
            {selectedProducts.size > 0 && (
              <div className="p-4 bg-stone-50 border border-stone-200">
                <div className="flex items-center justify-between text-lg">
                  <span className="text-stone-700">Add-Ons Total:</span>
                  <span className="font-medium text-stone-800">{formatPrice(getTotalPrice())}</span>
                </div>
              </div>
            )}

            <button
              onClick={handleContinue}
              className="w-full px-8 py-4 bg-custom-primary text-white hover:bg-custom transition-colors text-lg"
            >
              Continue
            </button>
          </div>
        </>
      )}
    </div>
  );
}
