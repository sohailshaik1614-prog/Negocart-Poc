import crypto from "crypto";
import { NegoZaarRepository } from "@/database/repository";
import { ShopifySyncService } from "./shopify-sync-service";

export interface ShopifyWebhookResult {
  handled: boolean;
  topic: string;
  shopDomain: string;
  details?: Record<string, unknown>;
}

export class ShopifyWebhookHandler {
  /**
   * Dispatches incoming Shopify webhook events to their corresponding domain handlers.
   */
  public static async handleWebhook(
    topic: string,
    shopDomain: string,
    payload: Record<string, any>
  ): Promise<ShopifyWebhookResult> {
    const cleanShopDomain = shopDomain.toLowerCase().trim();
    const store = await NegoZaarRepository.getStoreByPlatformStoreId("SHOPIFY", cleanShopDomain);

    switch (topic) {
      case "app/uninstalled": {
        if (store) {
          await ShopifySyncService.disconnectStore(store.id);
          await NegoZaarRepository.recordAnalyticsEvent({
            id: crypto.randomUUID(),
            storeId: store.id,
            eventType: "STORE_UNINSTALLED",
            properties: {
              shopDomain: cleanShopDomain,
              uninstalledAt: new Date().toISOString(),
            },
            occurredAt: new Date().toISOString(),
          });
        }
        return {
          handled: true,
          topic,
          shopDomain: cleanShopDomain,
          details: { storeId: store?.id, status: "DISCONNECTED" },
        };
      }

      case "products/create":
      case "products/update": {
        if (!store) {
          return { handled: false, topic, shopDomain: cleanShopDomain, details: { error: "Store not found" } };
        }

        const primaryVariant = payload.variants?.[0];
        const rawPrice = primaryVariant ? parseFloat(primaryVariant.price) : 0;
        const externalProductId = `gid://shopify/Product/${payload.id}`;

        const syncedProduct = await NegoZaarRepository.upsertSyncedProduct({
          storeId: store.id,
          externalProductId,
          title: payload.title || "Untitled Product",
          handle: payload.handle || `product-${payload.id}`,
          sku: primaryVariant?.sku,
          originalPrice: rawPrice > 0 ? rawPrice : 1000,
          currency: store.currency,
          imageUrl: payload.image?.src || payload.images?.[0]?.src,
          inventoryQuantity: primaryVariant?.inventory_quantity ?? 0,
          isActive: payload.status === "active",
        });

        return {
          handled: true,
          topic,
          shopDomain: cleanShopDomain,
          details: { productId: syncedProduct.id, externalProductId },
        };
      }

      case "products/delete": {
        if (!store) {
          return { handled: false, topic, shopDomain: cleanShopDomain, details: { error: "Store not found" } };
        }

        const externalProductId = `gid://shopify/Product/${payload.id}`;
        const deleted = await NegoZaarRepository.deleteProductByExternalId(store.id, externalProductId);

        return {
          handled: true,
          topic,
          shopDomain: cleanShopDomain,
          details: { externalProductId, deleted },
        };
      }

      case "orders/create":
      case "orders/paid": {
        const discountCodes = payload.discount_codes || [];
        const storeId = store ? store.id : cleanShopDomain;
        const attributedCodes: string[] = [];

        for (const dc of discountCodes) {
          // Identify coupons issued by NegoZaar (default prefix NEGO-)
          if (dc.code && (dc.code.startsWith("NEGO-") || dc.code.startsWith("NEGO"))) {
            attributedCodes.push(dc.code);

            await NegoZaarRepository.recordAnalyticsEvent({
              id: crypto.randomUUID(),
              storeId,
              eventType: "ORDER_CONVERTED",
              properties: {
                orderId: payload.id,
                orderNumber: payload.order_number,
                discountCode: dc.code,
                discountAmount: parseFloat(dc.amount || "0"),
                amount: parseFloat(dc.amount || "0"),
                totalPrice: parseFloat(payload.total_price || "0"),
                currency: payload.currency || store?.currency || "INR",
                customerEmail: payload.customer?.email,
              },
              occurredAt: new Date().toISOString(),
            });
          }
        }

        return {
          handled: true,
          topic,
          shopDomain: cleanShopDomain,
          details: { orderId: payload.id, attributedDiscounts: attributedCodes },
        };
      }

      // Mandatory Shopify GDPR compliance webhooks
      case "customers/data_request":
      case "customers/redact":
      case "shop/redact": {
        console.log(`[Shopify GDPR Webhook] Acknowledged: ${topic} for ${cleanShopDomain}`);
        return {
          handled: true,
          topic,
          shopDomain: cleanShopDomain,
          details: { status: "acknowledged" },
        };
      }

      default: {
        return {
          handled: false,
          topic,
          shopDomain: cleanShopDomain,
          details: { reason: "Topic not handled" },
        };
      }
    }
  }
}
