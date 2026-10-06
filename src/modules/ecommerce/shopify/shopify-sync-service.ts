import crypto from "crypto";
import { env } from "@/config/env";
import { NegoZaarRepository } from "@/database/repository";
import { Store, StoreCredentials } from "@/core/types/store.types";
import { ProductWithNegotiationSettings } from "@/core/types/product.types";
import { ShopifyClient } from "./shopify-client";
import { ShopifyOAuth } from "./shopify-oauth";
import { ShopifyTokenVault } from "./shopify-token-vault";

export interface StoreConnectionResult {
  store: Store;
  syncStats: {
    totalSynced: number;
    activeCount: number;
    addedCount: number;
    updatedCount: number;
  };
  webhooksRegistered: number;
}

export interface ProductSyncResult {
  storeId: string;
  totalSynced: number;
  addedCount: number;
  updatedCount: number;
  syncedAt: string;
  products: ProductWithNegotiationSettings[];
  errors?: string[];
}

export class ShopifySyncService {
  /**
   * Connects or updates a merchant's Shopify store after OAuth completion.
   */
  public static async connectStore(
    merchantId: string,
    rawShopDomain: string,
    accessToken: string,
    scopes: string[] = []
  ): Promise<StoreConnectionResult> {
    const shopDomain = ShopifyOAuth.sanitizeShopDomain(rawShopDomain);
    const client = new ShopifyClient(shopDomain, accessToken);

    // Fetch shop info from Shopify
    let shopInfo;
    try {
      shopInfo = await client.getShopInfo();
    } catch {
      shopInfo = {
        name: shopDomain.replace(".myshopify.com", ""),
        currency: "INR",
      };
    }

    // Check if store already exists in NegoZaar
    let store = await NegoZaarRepository.getStoreByPlatformStoreId("SHOPIFY", shopDomain);

    if (!store) {
      store = await NegoZaarRepository.createStore({
        merchantId,
        platform: "SHOPIFY",
        platformStoreId: shopDomain,
        storeName: shopInfo.name || shopDomain,
        currency: shopInfo.currency || "INR",
        settings: {
          brandColor: "#16a34a",
          widgetTheme: "auto",
          position: "bottom-right",
          requireEmailToClaim: false,
        },
      });
    } else {
      // Re-activate store if previously disconnected
      store = await NegoZaarRepository.updateStore(store.id, {
        status: "ACTIVE",
        storeName: shopInfo.name || store.storeName,
        currency: shopInfo.currency || store.currency,
      });
    }

    // Securely encrypt access token via AES-256-GCM vault
    const encryptedAccessToken = ShopifyTokenVault.encrypt(accessToken);

    const creds: StoreCredentials = {
      id: crypto.randomUUID(),
      storeId: store.id,
      encryptedAccessToken,
      scopes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await NegoZaarRepository.saveStoreCredentials(creds);

    // Register webhooks with Shopify
    const appBaseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    let webhooksRegistered = 0;
    try {
      const hooks = await client.registerWebhooks(appBaseUrl);
      webhooksRegistered = hooks.length;
    } catch (err) {
      console.warn(`[ShopifySyncService] Webhook registration notice for ${shopDomain}:`, err);
    }

    // Automatically perform initial product sync
    const syncStats = await this.syncProducts(store.id);

    return {
      store,
      syncStats: {
        totalSynced: syncStats.totalSynced,
        activeCount: syncStats.products.filter((p) => p.isActive).length,
        addedCount: syncStats.addedCount,
        updatedCount: syncStats.updatedCount,
      },
      webhooksRegistered,
    };
  }

  /**
   * Synchronizes product catalog from Shopify into NegoZaar's database.
   */
  public static async syncProducts(storeId: string): Promise<ProductSyncResult> {
    const creds = await NegoZaarRepository.getStoreCredentials(storeId);
    if (!creds) {
      throw new Error(`Store credentials not found for storeId: ${storeId}`);
    }

    const store = await NegoZaarRepository.getStoreById(storeId);
    if (!store) {
      throw new Error(`Store not found: ${storeId}`);
    }

    // Decrypt permanent access token
    const accessToken = ShopifyTokenVault.decrypt(creds.encryptedAccessToken);
    const client = new ShopifyClient(store.platformStoreId, accessToken);

    const shopifyProducts = await client.getProducts(50);

    const syncedProducts: ProductWithNegotiationSettings[] = [];
    let addedCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    for (const sp of shopifyProducts) {
      try {
        const primaryVariant = sp.variants?.[0];
        const rawPrice = primaryVariant ? parseFloat(primaryVariant.price) : 0;
        const externalProductId = `gid://shopify/Product/${sp.id}`;

        // Check if product was already in our repository
        const existing = await NegoZaarRepository.getProductByExternalId(storeId, externalProductId);

        const synced = await NegoZaarRepository.upsertSyncedProduct({
          storeId,
          externalProductId,
          title: sp.title,
          handle: sp.handle || `product-${sp.id}`,
          sku: primaryVariant?.sku || `SKU-${sp.id}`,
          originalPrice: rawPrice > 0 ? rawPrice : 1000,
          currency: store.currency,
          imageUrl: sp.image?.src || sp.images?.[0]?.src,
          inventoryQuantity: primaryVariant?.inventory_quantity ?? 10,
          isActive: sp.status === "active",
        });

        if (existing) {
          updatedCount++;
        } else {
          addedCount++;
        }

        syncedProducts.push(synced);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Error syncing product ${sp.id}: ${msg}`);
      }
    }

    return {
      storeId,
      totalSynced: syncedProducts.length,
      addedCount,
      updatedCount,
      syncedAt: new Date().toISOString(),
      products: syncedProducts,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Disconnects a Shopify store, clears encrypted credentials, and updates status.
   */
  public static async disconnectStore(storeId: string): Promise<boolean> {
    const store = await NegoZaarRepository.getStoreById(storeId);
    if (!store) {
      throw new Error(`Store ${storeId} not found`);
    }

    await NegoZaarRepository.updateStore(storeId, {
      status: "DISCONNECTED",
    });

    await NegoZaarRepository.deleteStoreCredentials(storeId);
    return true;
  }
}
