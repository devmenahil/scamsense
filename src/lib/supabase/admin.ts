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
/** Insert-only tables the trusted writer fills directly (Step 8 caches). */
type InsertOnly<Row> = { Row: Row; Insert: Row; Update: Partial<Row>; Relationships: [] };
export type ProfileInterpretationRow = {
  user_id: string;
  fingerprint: string;
  classifier_version: string;
  status: "mapped" | "partial" | "unmapped";
  source: "gemini";
  activity_tags: string[];
  context_tags: string[];
  context_summary: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
};
export type ModuleScenarioOrderRow = {
  user_id: string;
  module_key: string;
  scenario_order: string[];
  scores: unknown;
  routing_source: string;
  interpretation_fingerprint: string | null;
  routing_version: string;
};
export interface TrustedWriterDatabase {
  public: {
    Tables: {
      profile_interpretations: InsertOnly<ProfileInterpretationRow>;
      module_scenario_orders: InsertOnly<ModuleScenarioOrderRow>;
    };
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
      /** Step 7 (supabase/migrations/20261111090000_paypal_checkout.sql): PayPal Sandbox orders and captures. */
      record_payment_order: Fn<{
        p_user_id: string;
        p_attempt_id: string;
        p_request_id: string;
        p_paypal_order_id: string;
        p_paypal_order_status: string;
        p_amount_minor: number;
        p_currency: string;
      }>;
      record_payment_capture: Fn<{
        p_user_id: string;
        p_payment_id: string;
        p_paypal_capture_id: string;
        p_paypal_capture_status: string;
        p_paypal_order_status: string;
        p_amount_minor: number;
        p_currency: string;
      }>;
      update_payment_order: Fn<{
        p_user_id: string;
        p_payment_id: string;
        p_status: "PENDING" | "CANCELLED" | "FAILED";
        p_paypal_order_status: string | null;
        p_paypal_capture_id: string | null;
        p_paypal_capture_status: string | null;
        p_failure_code: string | null;
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
      /** Step 8 (supabase/migrations/20261112090000_hybrid_intelligence.sql). */
      claim_scenario_personalization: Fn<{
        p_user_id: string;
        p_scenario_key: string;
        p_content_version: string;
      }>;
      complete_scenario_personalization: Fn<{
        p_user_id: string;
        p_personalization_id: string;
        p_source: "gemini" | "fallback";
        p_slots: Record<string, string>;
        /** Added by 20261113090000_personalization_intro.sql (optional, defaults to null). */
        p_intro_line?: string | null;
        p_fallback_reason: string | null;
        p_model: string | null;
        p_prompt_version: string;
        p_input_tokens: number | null;
        p_output_tokens: number | null;
        p_latency_ms: number | null;
      }>;
      link_attempt_personalization: Fn<{
        p_user_id: string;
        p_attempt_id: string;
        p_personalization_id: string;
      }>;
      claim_attempt_evaluation: Fn<{ p_user_id: string; p_attempt_id: string }>;
      fail_attempt_evaluation: Fn<{ p_user_id: string; p_attempt_id: string; p_reason: string }>;
      // Step 9 (20261114090000_recovery_playbooks.sql)
      claim_recovery_playbook: Fn<{ p_user_id: string; p_attempt_id: string }>;
      complete_recovery_playbook: Fn<{
        p_user_id: string;
        p_attempt_id: string;
        p_source: "gemini" | "fallback";
        p_policy_ids: string[];
        p_note: string | null;
        p_emphasis_step_ids: string[];
        p_kb_version: string;
        p_prompt_version: string;
        p_model: string | null;
        p_fallback_reason: string | null;
        p_input_tokens: number | null;
        p_output_tokens: number | null;
        p_latency_ms: number | null;
      }>;
      // Step 11 (20261115090000_module_rewards.sql)
      ensure_module_rewards: Fn<{ p_user_id: string; p_module_key: string }>;
      begin_certificate_email_request: Fn<{
        p_user_id: string;
        p_certificate_id: string;
        p_recipient_email: string;
        p_idempotency_key: string;
      }>;
      finish_certificate_email_request: Fn<{
        p_user_id: string;
        p_request_id: string;
        p_status: "SUBMITTED" | "FAILED";
        p_http_status: number | null;
        p_error_code: string | null;
      }>;
      record_attempt_evaluation: Fn<{
        p_user_id: string;
        p_attempt_id: string;
        p_source: "gemini" | "fallback";
        p_model: string | null;
        p_prompt_version: string;
        p_decision_correct: boolean;
        p_decision_assessment: string;
        p_recognized_evidence_ids: string[];
        p_missed_evidence_ids: string[];
        p_unsupported_assumptions: string[];
        p_reasoning_explanation: string;
        p_verification_feedback: string;
        p_payment_behavior_feedback: string;
        p_improvement_advice: string;
        p_educational_takeaway: string;
        p_humorous_comment: string;
        p_evaluation_confidence: string | null;
        p_input_tokens: number | null;
        p_output_tokens: number | null;
        p_latency_ms: number | null;
        p_decision_points: number;
        p_reasoning_points: number;
        p_verification_points: number;
        p_payment_safety_points: number;
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
