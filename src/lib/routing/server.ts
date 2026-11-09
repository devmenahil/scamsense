import "server-only";
/**
 * Hybrid routing service (Step 8). Resolves a learner's routing tags — predefined mappings first, exact label matches
 * and neutral context next, Gemini only for meaningful custom text that isn't cached — then ranks the two scenarios of
 * ONE module with the deterministic formula and persists the order once (module_scenario_orders, insert-only).
 *
 * Reads use the user's session client (RLS). Writes use the trusted writer with the verified session's user id.
 */
import { getModule, type ModuleKey } from "@/content/modules";
import { SCENARIO_TEMPLATES } from "@/content/scenarios/templates.server";
import { recordCacheHit, recordFallback } from "@/lib/ai/usage";
import {
  rankModuleScenarios,
  ROUTING_VERSION,
  type ResolvedProfileTags,
  type ScenarioRelevance,
} from "@/lib/domain/routing";
import { getTrustedWriter } from "@/lib/supabase/admin";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { classifyCustomProfile } from "./classifier";
import {
  CLASSIFIER_VERSION,
  combineTags,
  planInterpretation,
  predefinedTags,
  type ProfileInterpretation,
  type RoutingProfile,
} from "./profileTags";

export type RoutingSource =
  | "predefined"
  | "custom_exact"
  | "custom_gemini"
  | "custom_neutral"
  | "custom_fallback"
  | "legacy_initialization";

export interface ResolvedRouting {
  tags: ResolvedProfileTags;
  interpretation: ProfileInterpretation | null;
  source: Exclude<RoutingSource, "legacy_initialization">;
  fingerprint: string | null;
  /** Gemini classification requests made while resolving (0 for predefined or cached profiles). */
  classificationCalls: number;
}

/** Reads the routing-relevant profile fields (tolerates the Step 8 migration not being applied yet). */
export async function loadRoutingProfile(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<RoutingProfile> {
  const full = await supabase
    .from("profiles")
    .select("occupation, custom_occupation, financial_activities, custom_activity")
    .eq("user_id", userId)
    .maybeSingle<{
      occupation: string | null;
      custom_occupation: string | null;
      financial_activities: string[] | null;
      custom_activity: string | null;
    }>();
  if (!full.error && full.data) {
    return {
      occupation: full.data.occupation,
      customOccupation: full.data.custom_occupation,
      financialActivities: full.data.financial_activities ?? [],
      customActivity: full.data.custom_activity,
    };
  }
  const basic = await supabase
    .from("profiles")
    .select("occupation, financial_activities")
    .eq("user_id", userId)
    .maybeSingle<{ occupation: string | null; financial_activities: string[] | null }>();
  return {
    occupation: basic.data?.occupation ?? null,
    customOccupation: null,
    financialActivities: basic.data?.financial_activities ?? [],
    customActivity: null,
  };
}

function merge(a: ProfileInterpretation, b: ProfileInterpretation): ProfileInterpretation {
  const activityTags = [...new Set([...a.activityTags, ...b.activityTags])];
  const contextTags = [...new Set([...a.contextTags, ...b.contextTags])];
  return {
    status:
      activityTags.length + contextTags.length === 0
        ? "unmapped"
        : b.status === "unmapped"
          ? "partial"
          : b.status,
    source: b.source,
    activityTags,
    contextTags,
    contextSummary: b.contextSummary ?? a.contextSummary,
  };
}

async function readCachedInterpretation(
  supabase: SupabaseServerClient,
  userId: string,
  fingerprint: string,
): Promise<ProfileInterpretation | null> {
  const { data, error } = await supabase
    .from("profile_interpretations")
    .select("status, activity_tags, context_tags, context_summary")
    .eq("user_id", userId)
    .eq("fingerprint", fingerprint)
    .eq("classifier_version", CLASSIFIER_VERSION)
    .maybeSingle<{
      status: ProfileInterpretation["status"];
      activity_tags: string[];
      context_tags: string[];
      context_summary: string | null;
    }>();
  if (error || !data) return null;
  return {
    status: data.status,
    source: "gemini",
    activityTags: data.activity_tags as ProfileInterpretation["activityTags"],
    contextTags: data.context_tags as ProfileInterpretation["contextTags"],
    contextSummary: data.context_summary,
  };
}

/**
 * Resolves routing tags. `allowGemini: false` never calls Gemini (page renders, legacy initialization): uncached
 * custom text then contributes nothing beyond deterministic matches (safe default, recorded as `custom_fallback`).
 */
export async function resolveRoutingTags(
  supabase: SupabaseServerClient,
  userId: string,
  profile: RoutingProfile,
  options: { allowGemini: boolean },
): Promise<ResolvedRouting> {
  const predefined = predefinedTags(profile);
  const plan = planInterpretation(profile);
  if (plan.kind === "none") {
    return {
      tags: combineTags(predefined, null),
      interpretation: null,
      source: "predefined",
      fingerprint: null,
      classificationCalls: 0,
    };
  }
  if (plan.kind === "deterministic") {
    return {
      tags: combineTags(predefined, plan.interpretation),
      interpretation: plan.interpretation,
      source: plan.interpretation.source === "exact_match" ? "custom_exact" : "custom_neutral",
      fingerprint: null,
      classificationCalls: 0,
    };
  }

  const cached = await readCachedInterpretation(supabase, userId, plan.fingerprint);
  if (cached) {
    recordCacheHit("classification");
    const interpretation = merge(plan.partial, cached);
    return {
      tags: combineTags(predefined, interpretation),
      interpretation,
      source: "custom_gemini",
      fingerprint: plan.fingerprint,
      classificationCalls: 0,
    };
  }

  const fallback = (calls: number): ResolvedRouting => {
    recordFallback("classification");
    return {
      tags: combineTags(predefined, plan.partial),
      interpretation: plan.partial,
      source: "custom_fallback",
      fingerprint: plan.fingerprint,
      classificationCalls: calls,
    };
  };
  if (!options.allowGemini) return fallback(0);

  const result = await classifyCustomProfile(
    {
      occupationText: plan.occupationText,
      activityText: plan.activityText,
      predefinedActivities: profile.financialActivities,
      occupation: profile.occupation,
    },
    userId,
  );
  if (!result.ok) return fallback(result.retries + 1);

  // Persist the VALIDATED interpretation only (insert-once; a concurrent duplicate is ignored).
  try {
    const { error } = await getTrustedWriter().from("profile_interpretations").upsert(
      {
        user_id: userId,
        fingerprint: plan.fingerprint,
        classifier_version: CLASSIFIER_VERSION,
        status: result.value.status,
        source: "gemini",
        activity_tags: result.value.activityTags,
        context_tags: result.value.contextTags,
        context_summary: result.value.contextSummary,
        model: result.model,
        input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens,
      },
      { onConflict: "user_id,fingerprint", ignoreDuplicates: true },
    );
    if (error) console.error("[routing] interpretation not cached", { code: error.code });
  } catch {
    console.error("[routing] interpretation not cached (writer unavailable)");
  }
  const interpretation = merge(plan.partial, result.value);
  return {
    tags: combineTags(predefined, interpretation),
    interpretation,
    source: "custom_gemini",
    fingerprint: plan.fingerprint,
    classificationCalls: result.retries + 1,
  };
}

/** The deterministic ranking of one module for resolved tags (no I/O). */
export function rankModule(moduleKey: ModuleKey, tags: ResolvedProfileTags): ScenarioRelevance[] {
  const mod = getModule(moduleKey);
  if (!mod) throw new Error("unknown module");
  return rankModuleScenarios(
    tags,
    mod.scenarios.map((s) => ({
      key: s.key,
      moduleKey: mod.key,
      activityTags: SCENARIO_TEMPLATES[s.key].activityTags,
      contextTags: SCENARIO_TEMPLATES[s.key].contextTags,
    })),
  );
}

export async function readModuleOrder(
  supabase: SupabaseServerClient,
  userId: string,
  moduleKey: string,
): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("module_scenario_orders")
    .select("scenario_order")
    .eq("user_id", userId)
    .eq("module_key", moduleKey)
    .maybeSingle<{ scenario_order: string[] }>();
  if (error || !data) return null;
  return data.scenario_order;
}

/**
 * Returns the module's persisted order, creating it once if missing. Never reorders an existing row (the table is
 * insert-only), so refreshes, new sign-ins, profile edits, and replays can't change a module's order.
 * Failures are non-fatal: the caller keeps the authored order and the next call tries again.
 */
export async function ensureModuleOrder(
  supabase: SupabaseServerClient,
  userId: string,
  moduleKey: ModuleKey,
  options: { allowGemini: boolean; legacy?: boolean },
): Promise<{
  order: string[];
  created: boolean;
  scores?: ScenarioRelevance[];
  source?: RoutingSource;
} | null> {
  const existing = await readModuleOrder(supabase, userId, moduleKey);
  if (existing) return { order: existing, created: false };
  try {
    const profile = await loadRoutingProfile(supabase, userId);
    const resolved = await resolveRoutingTags(supabase, userId, profile, {
      allowGemini: options.allowGemini,
    });
    const scores = rankModule(moduleKey, resolved.tags);
    const order = scores.map((s) => s.scenarioKey);
    const source: RoutingSource = options.legacy ? "legacy_initialization" : resolved.source;
    const { error } = await getTrustedWriter()
      .from("module_scenario_orders")
      .upsert(
        {
          user_id: userId,
          module_key: moduleKey,
          scenario_order: order,
          scores: scores.map((s) => ({
            scenario: s.scenarioKey,
            A: s.activityBp,
            C: s.contextBp,
            E: s.evidenceBp,
            D: s.difficultyBp,
            total: s.totalBp,
          })),
          routing_source: source,
          interpretation_fingerprint: resolved.fingerprint,
          routing_version: ROUTING_VERSION,
        },
        { onConflict: "user_id,module_key", ignoreDuplicates: true },
      );
    if (error) {
      console.error("[routing] order not saved", { code: error.code });
      return null;
    }
    // Re-read: a concurrent request may have written first; the stored row always wins.
    const stored = await readModuleOrder(supabase, userId, moduleKey);
    return { order: stored ?? order, created: !stored || stored.join() === order.join(), scores, source };
  } catch (e) {
    console.error("[routing] order unavailable", { name: e instanceof Error ? e.name : typeof e });
    return null;
  }
}
