import { createClient } from "@supabase/supabase-js";
import { env } from "@/config/env";

/**
 * Supabase Client Provider
 *
 * Provides typed Supabase clients for both browser anonymous contexts
 * and privileged server-side operations (Admin / Service Role).
 */
export const getSupabaseAnonClient = () => {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
      },
    }
  );
};

export const getSupabaseAdminClient = () => {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
};
