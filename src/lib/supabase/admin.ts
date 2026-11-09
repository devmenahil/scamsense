import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

/**
 * Trusted-writer Supabase client (role `service_role`), for gameplay WRITES only: starting module runs, attempts,
 * training-funds payments, and completions (supabase/migrations/20261109120000_progression_wallet.sql). Those
 * database functions are not executable with the publishable key, so the browser can never award itself points or
 * move training funds (R32).
 *
 * Rules: server code only; never used for reads that should be scoped by RLS (use the user's session client for
 * those); always pass the user id that came from the VERIFIED session, never one from a request body.
 *
 * Accepts either the legacy service-role JWT or a new-style secret key (sb_secret_…) in SUPABASE_SERVICE_ROLE_KEY.
 */

export class TrustedWriterNotConfiguredError extends Error {
  constructor() {
    super("SUPABASE_SERVICE_ROLE_KEY is not set: gameplay writes are unavailable.");
    this.name = "TrustedWriterNotConfiguredError";
  }
}

/** Typed signatures of the trusted-writer database functions (see the migration for their contracts). */
type Fn<Args> = { Args: Args; Returns: unknown };
export interface TrustedWriterDatabase {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      start_module_run: Fn<{
        p_user_id: string;
        p_module_key: string;
        p_currency: string;
        p_starting_funds_minor: number;
      }>;
      create_scenario_attempt: Fn<{ p_user_id: string; p_scenario_key: string; p_content_version: string }>;
      /** Step 6: the only way to change an attempt's state (supabase/migrations/20261110090000_scenario_engine.sql). */
      apply_attempt_event: Fn<{
        p_user_id: string;
        p_attempt_id: string;
        p_from_state: string;
        p_to_state: string;
        p_event_type: string;
        p_action_id: string | null;
        p_decision_id: string | null;
        p_justification: string | null;
      }>;
      record_training_payment: Fn<{
        p_user_id: string;
        p_attempt_id: string;
        p_amount_minor: number;
        p_idempotency_key: string;
      }>;
      complete_scenario_attempt: Fn<{
        p_user_id: string;
        p_attempt_id: string;
        p_decision_correct: boolean;
        p_decision_points: number;
        p_reasoning_points: number;
        p_verification_points: number;
        p_payment_safety_points: number;
        p_reasoning_source: "gemini" | "fallback";
        p_addressed_evidence_ids: string[];
        p_verification_action_ids: string[];
        p_scoring_version: string;
        p_payment_classification: "spending" | "fraud_loss" | null;
      }>;
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

let cached: ReturnType<typeof createClient<TrustedWriterDatabase>> | undefined;

export function isTrustedWriterConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getTrustedWriter() {
  const env = getServerEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    throw new TrustedWriterNotConfiguredError();
  cached ??= createClient<TrustedWriterDatabase>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );
  return cached;
}
