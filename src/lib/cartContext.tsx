import { createContext, useContext, useState, ReactNode } from 'react';

export interface ServiceDuration {
  id: string;
  duration_minutes: number;
  price_cents: number;
}

export interface CartItem {
  id: string;
  service: {
    id: string;
    name: string;
    description: string;
    is_pair_massage: boolean;
  };
  duration: ServiceDuration;
  specialist_id: string | null;
  is_pair_booking: boolean;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  getTotalDuration: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (item: CartItem) => {
    setItems((prev) => [...prev, item]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setItems([]);
  };

  const getTotalPrice = () => {
    return items.reduce((total, item) => {
      const basePrice = item.duration.price_cents;
      const multiplier = item.is_pair_booking ? 2 : 1;
      return total + basePrice * multiplier;
    }, 0);
  };

  const getTotalDuration = () => {
    return items.reduce((total, item) => total + item.duration.duration_minutes, 0);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        clearCart,
        getTotalPrice,
        getTotalDuration,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
