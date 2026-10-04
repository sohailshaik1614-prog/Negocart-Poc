export type EcommercePlatform = "SHOPIFY" | "WOOCOMMERCE" | "BIGCOMMERCE" | "MAGENTO" | "CUSTOM";
export type StoreStatus = "ACTIVE" | "PAUSED" | "DISCONNECTED";

export interface StoreSettings {
  widgetTheme?: "light" | "dark" | "auto";
  brandColor?: string;
  position?: "bottom-right" | "bottom-left" | "inline";
  buttonText?: string;
  requireEmailToClaim?: boolean;
  bannerTitle?: string;
}

export interface Store {
  id: string;
  merchantId: string;
  platform: EcommercePlatform;
  platformStoreId: string; // e.g. "my-brand.myshopify.com"
  storeName: string;
  publicStoreKey: string; // Used by widget to authenticate storefront calls
  currency: string; // ISO 4217, e.g. "INR", "USD"
  status: StoreStatus;
  settings: StoreSettings;
  createdAt: string;
  updatedAt: string;
}

export interface StoreCredentials {
  id: string;
  storeId: string;
  encryptedAccessToken: string;
  apiKey?: string;
  encryptedApiSecret?: string;
  encryptedWebhookSecret?: string;
  scopes: string[];
  tokenExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}
