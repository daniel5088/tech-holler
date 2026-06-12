import { createClient } from "@supabase/supabase-js";
import { env, supabaseConfigured } from "@/lib/env";

export function getServiceSupabase() {
  if (!supabaseConfigured) {
    return null;
  }

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
