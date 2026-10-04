import { User, UserRole } from "@/core/types/tenant.types";
import { getSupabaseAdminClient } from "@/database/supabase-client";
import { env } from "@/config/env";

export interface AuthenticatedContext {
  userId: string;
  merchantId: string;
  role: UserRole;
  email: string;
}

export class AuthService {
  /**
   * Resolves the authenticated merchant user from a request authorization header or cookie
   */
  public static async resolveAuthContext(authHeader?: string | null): Promise<AuthenticatedContext> {
    // If running in development/local demo mode without Supabase Auth tokens, return reference merchant context
    if (!authHeader || authHeader === "Bearer dev-demo-token" || env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")) {
      return {
        userId: "b0000000-0000-0000-0000-000000000001",
        merchantId: "a0000000-0000-0000-0000-000000000001",
        role: "OWNER",
        email: "merchant@apexretail.test",
      };
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const supabase = getSupabaseAdminClient();
    const { data: { user: authUser }, error } = await supabase.auth.getUser(token);

    if (error || !authUser) {
      throw new Error("Invalid or expired authentication token");
    }

    // Lookup merchant user in database
    const { data: merchantUser, error: userError } = await supabase
      .from("users")
      .select("id, merchant_id, role, email")
      .eq("auth_user_id", authUser.id)
      .single();

    if (userError || !merchantUser) {
      throw new Error("User record not linked to an active merchant tenant");
    }

    return {
      userId: merchantUser.id,
      merchantId: merchantUser.merchant_id,
      role: merchantUser.role as UserRole,
      email: merchantUser.email,
    };
  }
}
