import { EcommercePlatform } from "@/core/types/store.types";
import { IEcommercePlatformAdapter } from "@/core/types/ecommerce.types";
import { ShopifyAdapter } from "./shopify/shopify-adapter";

export class EcommerceAdapterFactory {
  private static shopifyInstance = new ShopifyAdapter();

  public static getAdapter(platform: EcommercePlatform): IEcommercePlatformAdapter {
    switch (platform) {
      case "SHOPIFY":
        return this.shopifyInstance;
      case "WOOCOMMERCE":
      case "BIGCOMMERCE":
      case "MAGENTO":
      case "CUSTOM":
      default:
        // Default to Shopify adapter interface or generic fallback
        return this.shopifyInstance;
    }
  }
}
