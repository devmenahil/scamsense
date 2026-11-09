import { z } from "zod";

/**
 * Environment schemas (pure, testable). Imported by `env.ts` (server-only) and by tests.
 *
 * Phase 1: integrations are not wired yet, so service credentials are optional, but any value that IS set must be
 * well-formed. Later phases tighten individual fields to required as each integration lands.
 * The PayPal guard is enforced from day one: anything other than Sandbox is rejected (R28, R31).
 */

export const PAYPAL_SANDBOX_API_BASE = "https://api-m.sandbox.paypal.com";

/** `.env` files produce "" for blank keys. Treat blank as "not set". */
const optionalString = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());
const optionalUrl = z.preprocess((v) => (v === "" ? undefined : v), z.url().optional());

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  /** New-style Supabase "publishable" key (sb_publishable_…). Preferred. */
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalString,
  /** Legacy anon key. Accepted as a fallback when no publishable key is set. */
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: optionalString,
});

export const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  GEMINI_API_KEY: optionalString,
  GEMINI_MODEL: optionalString,
  GEMINI_TIMEOUT_MS: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : Number(v)),
    z.number().int().min(1000).max(30000).default(9000),
  ),
  /** Step 8: global Gemini requests per minute for this server (rate limiter in src/lib/ai/gemini.ts). */
  GEMINI_MAX_RPM: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : Number(v)),
    z.number().int().min(1).max(1000).optional(),
  ),
  PAYPAL_ENV: z.preprocess(
    (v) => (v === "" || v === undefined ? "sandbox" : v),
    z.literal("sandbox", { error: "PAYPAL_ENV must be 'sandbox'. ScamSense never runs live PayPal." }),
  ),
  PAYPAL_API_BASE: z.preprocess(
    (v) => (v === "" || v === undefined ? PAYPAL_SANDBOX_API_BASE : v),
    z.literal(PAYPAL_SANDBOX_API_BASE, {
      error: `PAYPAL_API_BASE must be ${PAYPAL_SANDBOX_API_BASE}. ScamSense never runs live PayPal.`,
    }),
  ),
  PAYPAL_CLIENT_SECRET: optionalString,
  ZAPIER_CERTIFICATE_WEBHOOK_URL: optionalUrl,
  ZAPIER_WEBHOOK_SECRET: optionalString,
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/**
 * Supabase URL + browser-safe key, or null when Supabase is not configured. The publishable key is preferred; the
 * legacy anon key is a fallback. Both are public by design (RLS protects the data). The service-role key is never
 * used here.
 */
export function supabasePublicConfig(env: PublicEnv): { url: string; key: string } | null {
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !key) return null;
  return { url: env.NEXT_PUBLIC_SUPABASE_URL, key };
}
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Parses an env record and throws a readable error listing every invalid key (values are never printed). */
export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined>,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid ScamSense environment configuration:\n${issues}`);
  }
  return result.data;
}
