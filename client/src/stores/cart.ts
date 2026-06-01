import { create } from "zustand";
import type { CartItem } from "@shared/schema";

interface CartStore {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}

function loadCart(): CartItem[] {
  try {
    const saved = localStorage.getItem("aura-cart");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  localStorage.setItem("aura-cart", JSON.stringify(items));
}

export const useCart = create<CartStore>((set, get) => ({
  items: loadCart(),
  addItem: (item) => {
    set((state) => {
      const existing = state.items.find((i) => i.productId === item.productId);
      let newItems: CartItem[];
      if (existing) {
        newItems = state.items.map((i) =>
          i.productId === item.productId
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      } else {
        newItems = [...state.items, { ...item, quantity: 1 }];
      }
      saveCart(newItems);
      return { items: newItems };
    });
  },
  removeItem: (productId) => {
    set((state) => {
      const newItems = state.items.filter((i) => i.productId !== productId);
      saveCart(newItems);
      return { items: newItems };
    });
  },
  updateQuantity: (productId, quantity) => {
    set((state) => {
      if (quantity <= 0) {
        const newItems = state.items.filter((i) => i.productId !== productId);
        saveCart(newItems);
        return { items: newItems };
      }
      const newItems = state.items.map((i) =>
        i.productId === productId ? { ...i, quantity } : i
      );
      saveCart(newItems);
      return { items: newItems };
    });
  },
  clearCart: () => {
    saveCart([]);
    set({ items: [] });
  },
  getTotal: () => {
    return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },
  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));
