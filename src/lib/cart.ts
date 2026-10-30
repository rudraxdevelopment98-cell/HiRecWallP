/**
 * Client-side cart stored in localStorage. A visual/functional cart for the
 * browse→checkout flow; real payment is wired through /api/checkout when a
 * provider is configured. Emits a `cart:updated` window event so the header
 * badge and cart page stay in sync.
 */
export interface CartItem {
  id: string;
  slug: string;
  title: string;
  image: string | null;
  price: number | null; // in the region's unit (rupees or credits); null = free
  priceLabel: string; // pre-formatted for display
  licence: 'personal' | 'commercial';
  resolution?: string;
}

const KEY = 'hw_cart';

export function getCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as CartItem[];
  } catch {
    return [];
  }
}

function save(items: CartItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('cart:updated'));
  } catch {
    /* ignore (private mode / blocked storage) */
  }
}

export function addItem(item: CartItem) {
  const items = getCart();
  if (!items.some((i) => i.id === item.id && i.licence === item.licence)) {
    items.push(item);
    save(items);
  }
}

export function removeItem(id: string, licence?: CartItem['licence']) {
  save(getCart().filter((i) => !(i.id === id && (licence === undefined || i.licence === licence))));
}

export function clearCart() {
  save([]);
}

export function cartCount(): number {
  return getCart().length;
}

export function cartSubtotal(): number {
  return getCart().reduce((s, i) => s + (i.price ?? 0), 0);
}
