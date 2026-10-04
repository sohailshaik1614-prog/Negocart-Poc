import { TenantAccessDeniedError } from "@/core/errors/domain-errors";
import { NegoZaarRepository } from "@/database/repository";
import { AuthenticatedContext } from "../auth/auth-service";

export class TenantContextManager {
  /**
   * Enforces that the current authenticated user owns or has access to the specified store
   */
  public static async validateStoreAccess(auth: AuthenticatedContext, storeId: string): Promise<void> {
    const store = await NegoZaarRepository.getStoreById(storeId);
    if (!store) {
      throw new TenantAccessDeniedError("Store does not exist");
    }

    if (store.merchantId !== auth.merchantId) {
      throw new TenantAccessDeniedError("You do not have permission to access this store");
    }
  }
}
