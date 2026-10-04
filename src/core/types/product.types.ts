export interface Product {
  id: string;
  storeId: string;
  externalProductId: string; // Platform Product GID or ID
  title: string;
  handle?: string;
  sku?: string;
  originalPrice: number;
  currency: string;
  imageUrl?: string;
  inventoryQuantity: number;
  isActive: boolean;
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductSyncPayload {
  externalProductId: string;
  title: string;
  handle?: string;
  sku?: string;
  originalPrice: number;
  currency: string;
  imageUrl?: string;
  inventoryQuantity?: number;
}
