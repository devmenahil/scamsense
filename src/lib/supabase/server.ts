import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicConfig } from "@/lib/env.schema";
import { getServerEnv } from "@/lib/env";

/**
 * Supabase client for Server Components and Route Handlers, bound to the signed-in user's cookie session.
 * Uses the publishable (or legacy anon) key only. Every query runs as the user, so Row Level Security applies.
 * The service-role key is never used for auth or profiles.
 */

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / publishable key missing).");
    this.name = "SupabaseNotConfiguredError";
  }
}

export function isSupabaseConfigured(): boolean {
  return supabasePublicConfig(getServerEnv()) !== null;
}

export async function createSupabaseServerClient() {
  const config = supabasePublicConfig(getServerEnv());
  if (!config) throw new SupabaseNotConfiguredError();
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot set cookies. Middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
