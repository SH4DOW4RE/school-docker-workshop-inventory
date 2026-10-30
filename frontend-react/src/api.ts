import type { InventoryStats, ItemForm, Movement, StockItem } from './types';

// Same-origin /api is proxied by the frontend's Node server using runtime
// BACKEND_HOST and BACKEND_PORT. Never expose a private backend hostname to JS.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new Error('Cannot reach the application server. Verify the API is running.');
  }
  const body = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

export const api = {
  items: async () => (await request<{ items: StockItem[] }>('/items')).items,
  stats: async () => (await request<{ stats: InventoryStats }>('/stats')).stats,
  movements: async () => (await request<{ movements: Movement[] }>('/movements')).movements,
  createItem: (item: ItemForm) => request<{ item: StockItem }>('/items', { method: 'POST', body: JSON.stringify(item) }),
  updateItem: (id: number, item: Omit<ItemForm, 'quantity'>) => request<{ item: StockItem }>(`/items/${id}`, { method: 'PUT', body: JSON.stringify(item) }),
  deleteItem: (id: number) => request<{ message: string }>(`/items/${id}`, { method: 'DELETE' }),
  adjustStock: (itemId: number, delta: number, note: string) => request<{ movement: Movement; new_quantity: number }>('/movements', {
    method: 'POST', body: JSON.stringify({ item_id: itemId, delta, note }),
  }),
};
