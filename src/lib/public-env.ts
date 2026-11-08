import { parseEnv, publicEnvSchema } from "./env.schema";

/**
 * Browser-safe env. Next.js inlines NEXT_PUBLIC_* values only when referenced literally, so each key is listed.
 */
export const publicEnv = parseEnv(publicEnvSchema, {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
});
