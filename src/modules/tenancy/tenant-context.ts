import { TenantAccessDeniedError } from "@/core/errors/domain-errors";
import { NegoZaarRepository } from "@/database/repository";
import { AuthenticatedContext } from "../auth/auth-service";
import { Store } from "@/core/types/store.types";
import { Product } from "@/core/types/product.types";
import { NegotiationSession } from "@/core/types/negotiation.types";

export class TenantContextManager {
  /**
   * Enforces that the current authenticated user owns or has access to the specified store.
   * Returns the verified Store entity.
   */
  public static async validateStoreAccess(
    auth: AuthenticatedContext,
    storeId: string
  ): Promise<Store> {
    const store = await NegoZaarRepository.getStoreById(storeId);
    if (!store) {
      throw new TenantAccessDeniedError("Store not found or access denied");
    }

    if (store.merchantId !== auth.merchantId) {
      throw new TenantAccessDeniedError("Access denied: You do not have permission to access this store");
    }

    return store;
  }

  /**
   * Enforces that the requested product belongs to a store owned by the authenticated merchant.
   * Returns the verified Product entity.
   */
  public static async validateProductAccess(
    auth: AuthenticatedContext,
    productId: string
  ): Promise<Product> {
    const product = await NegoZaarRepository.getProductById(productId);
    if (!product) {
      throw new TenantAccessDeniedError("Product not found or access denied");
    }

    // Validate that the product's store belongs to the authenticated merchant
    await this.validateStoreAccess(auth, product.storeId);

    return product;
  }

  /**
   * Enforces that the negotiation session belongs to the authenticated merchant.
   * Returns the verified NegotiationSession entity.
   */
  public static async validateSessionAccess(
    auth: AuthenticatedContext,
    sessionId: string
  ): Promise<NegotiationSession> {
    const session = await NegoZaarRepository.getSessionById(sessionId);
    if (!session) {
      throw new TenantAccessDeniedError("Negotiation session not found or access denied");
    }

    if (session.merchantId && session.merchantId !== auth.merchantId) {
      throw new TenantAccessDeniedError("Access denied: You do not have permission to access this session");
    }

    // If merchantId not directly on session, verify via store
    if (!session.merchantId) {
      await this.validateStoreAccess(auth, session.storeId);
    }

    return session;
  }
}
