import "server-only";
/**
 * Scenario personalization service (Step 8, Component C).
 *
 *  • Every newly played scenario (all six, first or second in its module) gets ONE Gemini personalization when it is
 *    started, stored in scenario_personalizations and linked to the attempt (attempt_personalizations).
 *  • A refresh, a resumed attempt, opening apps/emails/invoices, or any re-render reads the stored instance: no call.
 *  • Replays REUSE the validated instance of that scenario (same narrative, same ground truth): no call.
 *  • Concurrent starts are serialized by claim_scenario_personalization (one generation in flight per scenario).
 *  • If Gemini is unavailable or its output is rejected, the authored defaults are stored as a tracked FALLBACK
 *    instance (source = 'fallback'); play continues normally and nothing claims the text was AI-generated.
 *  • An attempt's narrative never changes once visible: linking is only allowed while the attempt is still INTRO,
 *    and attempts created before Step 8 (no link) keep the authored defaults they were shown.
 */
import { z } from "zod";
import { getScenarioRender } from "@/content/scenarios/renders";
import type { ScenarioRender } from "@/content/scenarios/schema";
import { generateJson, InvalidOutputError } from "@/lib/ai/gemini";
import { recordCacheHit, recordFallback } from "@/lib/ai/usage";
import { formatMoney } from "@/lib/domain/currency";
import { scenarioAmountMinor } from "@/lib/domain/trainingFunds";
import {
  interpretationFingerprint,
  relevantCustomText,
  isVagueCustomText,
  CLASSIFIER_VERSION,
} from "@/lib/routing/profileTags";
import { getTrustedWriter } from "@/lib/supabase/admin";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import {
  buildPersonalizationPrompt,
  PERSONALIZATION_PROMPT_VERSION,
  PERSONALIZATION_SYSTEM,
  personalizationJsonSchema,
  type PersonalizationProfile,
} from "./prompt";
import { validatePersonalization, type ValidatedPersonalization } from "./validate";

export interface AttemptPersonalization {
  slots: Record<string, string>;
  /** Validated personalized intro (null → authored intro). */
  introLine: string | null;
  source: "gemini" | "fallback";
}

const outputShape = z.object({
  scenarioId: z.string(),
  introLine: z.string().nullable().optional(),
  slots: z.record(z.string(), z.unknown()),
});

/** Parses and validates Gemini's personalization; throws InvalidOutputError when nothing usable remains. */
export function parsePersonalizationOutput(render: ScenarioRender, raw: unknown): ValidatedPersonalization {
  const out = outputShape.parse(raw);
  if (out.scenarioId !== render.scenarioKey) throw new InvalidOutputError("wrong scenario");
  const v = validatePersonalization(render, out);
  if (render.slots.length > 0 && Object.keys(v.slots).length === 0)
    throw new InvalidOutputError("no valid slots");
  return v;
}

/** Reads the personalization linked to an attempt (null = authored defaults). Tolerates a missing table. */
export async function loadAttemptPersonalization(
  supabase: SupabaseServerClient,
  userId: string,
  attemptId: string,
): Promise<AttemptPersonalization | null> {
  type Row = {
    personalization_id: string;
    scenario_personalizations: {
      slots: Record<string, unknown>;
      intro_line?: string | null;
      source: "gemini" | "fallback" | null;
      status: string;
    } | null;
  };
  const read = (columns: string) =>
    supabase
      .from("attempt_personalizations")
      .select(`personalization_id, scenario_personalizations(${columns})`)
      .eq("attempt_id", attemptId)
      .eq("user_id", userId)
      .maybeSingle<Row>();
  let { data, error } = await read("slots, intro_line, source, status");
  // Before 20261113090000_personalization_intro.sql is applied, intro_line doesn't exist: keep the slots.
  if (error?.code === "42703" || error?.code === "PGRST204" || error?.code === "PGRST200")
    ({ data, error } = await read("slots, source, status"));
  if (error || !data?.scenario_personalizations) return null;
  const p = data.scenario_personalizations;
  if (p.status !== "ready" || !p.source) return null;
  const slots: Record<string, string> = {};
  for (const [k, v] of Object.entries(p.slots ?? {})) if (typeof v === "string") slots[k] = v;
  return { slots, introLine: p.intro_line ?? null, source: p.source };
}

async function loadPersonalizationProfile(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<PersonalizationProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "occupation, custom_occupation, financial_activities, custom_activity, payment_experience, financial_goal, custom_goal, age_bracket",
    )
    .eq("user_id", userId)
    .maybeSingle<{
      occupation: string | null;
      custom_occupation: string | null;
      financial_activities: string[] | null;
      custom_activity: string | null;
      payment_experience: string | null;
      financial_goal: string | null;
      custom_goal: string | null;
      age_bracket: string | null;
    }>();
  if (error || !data) return null;
  const profile: PersonalizationProfile = {
    occupation: data.occupation,
    customOccupation: data.custom_occupation,
    financialActivities: data.financial_activities ?? [],
    customActivity: data.custom_activity,
    paymentExperience: data.payment_experience,
    financialGoal: data.financial_goal,
    customGoal: data.custom_goal,
    ageBracket: data.age_bracket,
    contextSummary: null,
  };
  // Reuse a cached classifier summary if one exists for the current custom text (never triggers a new call).
  const custom = relevantCustomText(profile);
  const occ = custom.occupation && !isVagueCustomText(custom.occupation) ? custom.occupation : null;
  const act = custom.activity && !isVagueCustomText(custom.activity) ? custom.activity : null;
  if (occ || act) {
    const { data: cached } = await supabase
      .from("profile_interpretations")
      .select("context_summary")
      .eq("user_id", userId)
      .eq("fingerprint", interpretationFingerprint(occ, act))
      .eq("classifier_version", CLASSIFIER_VERSION)
      .maybeSingle<{ context_summary: string | null }>();
    profile.contextSummary = cached?.context_summary ?? null;
  }
  return profile;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function readInstance(supabase: SupabaseServerClient, userId: string, id: string) {
  const { data } = await supabase
    .from("scenario_personalizations")
    .select("status")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle<{ status: string }>();
  return data?.status ?? null;
}

/**
 * Makes sure an attempt that is about to be shown has its personalized narrative. Safe to call repeatedly: an
 * attempt that is already linked, or already past INTRO, returns immediately without any Gemini call.
 */
export async function ensureAttemptPersonalization(
  supabase: SupabaseServerClient,
  userId: string,
  attempt: { id: string; scenarioKey: string; state: string; startingFundsMinor: number; currency: string },
): Promise<{ outcome: "linked_existing" | "reused" | "generated" | "fallback" | "skipped" }> {
  if (attempt.state !== "INTRO") return { outcome: "skipped" };
  const already = await loadAttemptPersonalization(supabase, userId, attempt.id);
  if (already) return { outcome: "linked_existing" };
  const render = getScenarioRender(attempt.scenarioKey);
  if (!render) return { outcome: "skipped" };

  let writer;
  try {
    writer = getTrustedWriter();
  } catch {
    return { outcome: "skipped" };
  }
  const link = async (personalizationId: string) => {
    const { error } = await writer.rpc("link_attempt_personalization", {
      p_user_id: userId,
      p_attempt_id: attempt.id,
      p_personalization_id: personalizationId,
    });
    if (error) console.error("[personalization] link failed", { reason: error.message });
  };

  try {
    let claim: { status: "ready" | "busy" | "claimed"; id: string } | null = null;
    for (let i = 0; i < 10; i++) {
      const { data, error } = await writer.rpc("claim_scenario_personalization", {
        p_user_id: userId,
        p_scenario_key: render.scenarioKey,
        p_content_version: render.contentVersion,
      });
      if (error) {
        console.error("[personalization] claim failed", { reason: error.message });
        return { outcome: "skipped" };
      }
      claim = data as { status: "ready" | "busy" | "claimed"; id: string };
      if (claim.status !== "busy") break;
      // Another request is generating this scenario right now: wait for it instead of calling Gemini twice.
      await sleep(1_000);
      if ((await readInstance(supabase, userId, claim.id)) === "ready") {
        await link(claim.id);
        recordCacheHit("personalization");
        return { outcome: "reused" };
      }
    }
    if (!claim || claim.status === "busy") return { outcome: "skipped" };
    if (claim.status === "ready") {
      await link(claim.id);
      recordCacheHit("personalization");
      return { outcome: "reused" };
    }

    // We hold the claim: generate once.
    const profile = await loadPersonalizationProfile(supabase, userId);
    const amountText = formatMoney(
      scenarioAmountMinor(render.scenarioKey, attempt.startingFundsMinor),
      attempt.currency,
    );
    const result = profile
      ? await generateJson({
          category: "personalization",
          rateKey: userId,
          systemInstruction: PERSONALIZATION_SYSTEM,
          prompt: buildPersonalizationPrompt(render, profile, amountText),
          jsonSchema: personalizationJsonSchema(render),
          parse: (raw) => parsePersonalizationOutput(render, raw),
          maxOutputTokens: 900,
          temperature: 0.8,
          thinking: "minimal",
        })
      : ({ ok: false, reason: "not_configured", retries: 0, latencyMs: 0 } as const);

    const ok = result.ok;
    if (!ok) recordFallback("personalization");
    const completeArgs = {
      p_user_id: userId,
      p_personalization_id: claim.id,
      p_source: (ok ? "gemini" : "fallback") as "gemini" | "fallback",
      p_slots: ok ? result.value.slots : {},
      p_fallback_reason: ok
        ? result.value.rejected.length
          ? `partial:${result.value.rejected.join(",")}`.slice(0, 200)
          : null
        : result.reason,
      p_model: ok ? result.model : null,
      p_prompt_version: PERSONALIZATION_PROMPT_VERSION,
      p_input_tokens: ok ? result.usage.inputTokens : null,
      p_output_tokens: ok ? result.usage.outputTokens : null,
      p_latency_ms: result.latencyMs,
    };
    let { error } = await writer.rpc("complete_scenario_personalization", {
      ...completeArgs,
      p_intro_line: ok ? result.value.introLine : null,
    });
    // Before the intro migration is applied the function has no p_intro_line: save the rest (authored intro shown).
    if (error?.code === "PGRST202")
      ({ error } = await writer.rpc("complete_scenario_personalization", completeArgs));
    if (error) {
      console.error("[personalization] save failed", { reason: error.message });
      return { outcome: "fallback" };
    }
    await link(claim.id);
    return { outcome: ok ? "generated" : "fallback" };
  } catch (e) {
    console.error("[personalization] unavailable", { name: e instanceof Error ? e.name : typeof e });
    return { outcome: "skipped" };
  }
}
