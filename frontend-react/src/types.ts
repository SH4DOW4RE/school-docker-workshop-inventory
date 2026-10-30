export type StockItem = {
  id: number;
  name: string;
  sku: string;
  category: string;
  unit: string;
  quantity: number;
  reorder_level: number;
  created_at: string;
  updated_at: string;
};

export type Movement = {
  id: number;
  item_id: number | null;
  item_name: string;
  delta: number;
  note: string;
  created_at: string;
};

export type CategoryStat = { category: string; item_count: number; units: number };

export type InventoryStats = {
  total_items: number;
  total_units: number;
  low_stock_items: number;
  categories: CategoryStat[];
};

export type ItemForm = {
  name: string;
  sku: string;
  category: string;
  unit: string;
  reorder_level: number;
  quantity: number;
};
