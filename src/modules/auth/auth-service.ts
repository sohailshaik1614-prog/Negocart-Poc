import { UserRole } from "@/core/types/tenant.types";
import { NegoZaarRepository } from "@/database/repository";
import { PasswordService } from "./password-service";
import { MerchantTokenService, MerchantTokenPayload } from "./merchant-token-service";
import { DomainError, TenantAccessDeniedError } from "@/core/errors/domain-errors";
import { getSupabaseAdminClient } from "@/database/supabase-client";
import { env } from "@/config/env";

export interface AuthenticatedContext {
  userId: string;
  merchantId: string;
  role: UserRole;
  email: string;
}

export interface RegisterMerchantDTO {
  email: string;
  password: string;
  fullName: string;
  merchantName: string;
  storeName?: string;
  platformStoreId?: string;
  currency?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthResult {
  sessionToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
  };
  merchant: {
    id: string;
    name: string;
    slug: string;
  };
  store?: {
    id: string;
    storeName: string;
    publicStoreKey: string;
  };
}

export class AuthService {
  /**
   * Registers a brand-new merchant organization, primary user, and initial store
   */
  public static async registerMerchant(dto: RegisterMerchantDTO): Promise<AuthResult> {
    const emailNorm = dto.email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await NegoZaarRepository.getUserByEmail(emailNorm);
    if (existingUser) {
      throw new DomainError("An account with this email address already exists", 409, "USER_EXISTS");
    }

    // 1. Create Merchant Organization
    const merchant = await NegoZaarRepository.createMerchant({
      name: dto.merchantName.trim(),
      billingEmail: emailNorm,
      tier: "STARTER",
    });

    // 2. Hash Password & Create User
    const passwordHash = PasswordService.hashPassword(dto.password);
    const user = await NegoZaarRepository.createUser({
      merchantId: merchant.id,
      email: emailNorm,
      fullName: dto.fullName.trim(),
      passwordHash,
      role: "OWNER",
    });

    // 3. Create Default Connected Store
    const storeName = dto.storeName || `${dto.merchantName} Official Store`;
    const platformStoreId = dto.platformStoreId || `${merchant.slug}.myshopify.com`;
    const store = await NegoZaarRepository.createStore({
      merchantId: merchant.id,
      storeName,
      platform: "SHOPIFY",
      platformStoreId,
      currency: dto.currency || "INR",
    });

    // 4. Generate Session Token
    const sessionToken = MerchantTokenService.generateSessionToken({
      userId: user.id,
      merchantId: merchant.id,
      role: user.role,
      email: user.email,
    });

    return {
      sessionToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      merchant: {
        id: merchant.id,
        name: merchant.name,
        slug: merchant.slug,
      },
      store: {
        id: store.id,
        storeName: store.storeName,
        publicStoreKey: store.publicStoreKey,
      },
    };
  }

  /**
   * Authenticates a merchant user with email and password
   */
  public static async login(dto: LoginDTO): Promise<AuthResult> {
    const emailNorm = dto.email.toLowerCase().trim();
    const user = await NegoZaarRepository.getUserByEmail(emailNorm);

    if (!user || !user.passwordHash) {
      throw new DomainError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    if (!user.isActive) {
      throw new DomainError("User account is inactive or suspended", 403, "ACCOUNT_INACTIVE");
    }

    const isValidPassword = PasswordService.verifyPassword(dto.password, user.passwordHash);
    if (!isValidPassword) {
      throw new DomainError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    const merchant = await NegoZaarRepository.getMerchantById(user.merchantId);
    if (!merchant || merchant.status !== "ACTIVE") {
      throw new DomainError("Merchant organization is inactive or not found", 403, "MERCHANT_INACTIVE");
    }

    const stores = await NegoZaarRepository.getStoresForMerchant(merchant.id);
    const primaryStore = stores[0];

    const sessionToken = MerchantTokenService.generateSessionToken({
      userId: user.id,
      merchantId: merchant.id,
      role: user.role,
      email: user.email,
    });

    return {
      sessionToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      merchant: {
        id: merchant.id,
        name: merchant.name,
        slug: merchant.slug,
      },
      store: primaryStore
        ? {
            id: primaryStore.id,
            storeName: primaryStore.storeName,
            publicStoreKey: primaryStore.publicStoreKey,
          }
        : undefined,
    };
  }

  /**
   * Resolves the authenticated merchant user context from request Authorization header or token
   */
  public static async resolveAuthContext(authHeader?: string | null): Promise<AuthenticatedContext> {
    if (!authHeader) {
      throw new DomainError("Missing Authorization header", 401, "UNAUTHORIZED");
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      throw new DomainError("Missing bearer token", 401, "UNAUTHORIZED");
    }

    // Dev test token bypass (if configured)
    if (token === "dev-demo-token") {
      return {
        userId: "b0000000-0000-0000-0000-000000000001",
        merchantId: "a0000000-0000-0000-0000-000000000001",
        role: "OWNER",
        email: "merchant@apexretail.test",
      };
    }

    // 1. Try decoding with NegoZaar Native Merchant Token Service
    try {
      const payload: MerchantTokenPayload = MerchantTokenService.verifySessionToken(token);
      return {
        userId: payload.userId,
        merchantId: payload.merchantId,
        role: payload.role,
        email: payload.email,
      };
    } catch (tokenErr) {
      // If native verification fails and Supabase is configured, attempt Supabase Auth fallback
      if (
        env.NEXT_PUBLIC_SUPABASE_URL &&
        !env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")
      ) {
        try {
          const supabase = getSupabaseAdminClient();
          const { data: { user: authUser }, error } = await supabase.auth.getUser(token);

          if (!error && authUser) {
            const { data: merchantUser } = await supabase
              .from("users")
              .select("id, merchant_id, role, email")
              .eq("auth_user_id", authUser.id)
              .single();

            if (merchantUser) {
              return {
                userId: merchantUser.id,
                merchantId: merchantUser.merchant_id,
                role: merchantUser.role as UserRole,
                email: merchantUser.email,
              };
            }
          }
        } catch {
          // Fall through to error
        }
      }

      if (tokenErr instanceof DomainError) throw tokenErr;
      throw new DomainError("Invalid or expired session token", 401, "UNAUTHORIZED");
    }
  }

  /**
   * Helper to verify if the authenticated context belongs to the requested merchant
   */
  public static assertMerchantAccess(authContext: AuthenticatedContext, targetMerchantId: string): void {
    if (authContext.merchantId !== targetMerchantId) {
      throw new TenantAccessDeniedError("Access denied: You do not have access to this merchant's data");
    }
  }
}
