import { ProductNegotiationSettings, NegotiationStrategy } from "./rule.types";

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

export interface ProductWithNegotiationSettings extends Product {
  negotiationSettings?: ProductNegotiationSettings | null;
}

export interface CreateProductDTO {
  storeId: string;
  title: string;
  originalPrice: number;
  currency?: string;
  sku?: string;
  handle?: string;
  imageUrl?: string;
  inventoryQuantity?: number;
  externalProductId?: string;
  
  // Negotiation configuration
  minAcceptablePrice: number;
  isNegotiationEnabled?: boolean;
  maxNegotiationRounds?: number;
  maxDiscountPercentage?: number;
  strategy?: NegotiationStrategy;
  autoAcceptPrice?: number;
  minOrderQuantity?: number;
  couponValidityHours?: number;
  customSystemPromptAddon?: string;
}

export interface UpdateProductDTO {
  title?: string;
  originalPrice?: number;
  currency?: string;
  sku?: string;
  handle?: string;
  imageUrl?: string;
  inventoryQuantity?: number;
  isActive?: boolean;
  
  // Negotiation configuration
  minAcceptablePrice?: number;
  isNegotiationEnabled?: boolean;
  maxNegotiationRounds?: number;
  maxDiscountPercentage?: number;
  strategy?: NegotiationStrategy;
  autoAcceptPrice?: number;
  minOrderQuantity?: number;
  couponValidityHours?: number;
  customSystemPromptAddon?: string;
}

export interface ProductFilterParams {
  storeId?: string;
  search?: string;
  isActive?: boolean;
  isNegotiationEnabled?: boolean;
  page?: number;
  limit?: number;
}
