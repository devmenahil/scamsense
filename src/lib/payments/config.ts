import "server-only";
import { getServerEnv } from "@/lib/env";
import { createPayPalClient, type PayPalClient } from "./paypal";

/**
 * Server-side PayPal Sandbox configuration. Uses the established variable names: NEXT_PUBLIC_PAYPAL_CLIENT_ID (public by
 * design: the browser SDK needs it) and PAYPAL_CLIENT_SECRET (server only). PAYPAL_ENV / PAYPAL_API_BASE are validated
 * by the env schema and can only be Sandbox.
 */
let cached: PayPalClient | undefined;

export function isPayPalConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.NEXT_PUBLIC_PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);
}

/** The PayPal client, or null when credentials are missing (checkout then shows as unavailable, R27-style). */
export function getPayPalClient(): PayPalClient | null {
  const env = getServerEnv();
  if (!env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) return null;
  cached ??= createPayPalClient({
    clientId: env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
    clientSecret: env.PAYPAL_CLIENT_SECRET,
    apiBase: env.PAYPAL_API_BASE,
  });
  return cached;
}
