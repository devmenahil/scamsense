/**
 * Turns a profile into approved routing tags (Step 8, hybrid routing). Pure and deterministic.
 *
 *  1. Predefined selections map through fixed tables (PROFILE_ACTIVITY_TAGS / PROFILE_CONTEXT_TAG): no Gemini.
 *  2. An "Other" description that exactly matches a predefined option (label or id, case/punctuation-insensitive) maps
 *     through the same tables: no Gemini.
 *  3. A vague description ("something else", "n/a") gets NEUTRAL context: no Gemini, nothing invented.
 *  4. Anything else is a meaningful custom description: it needs Gemini interpretation (src/lib/routing/classifier.ts),
 *     cached by a fingerprint of the normalized custom text, so unchanged text is never re-classified.
 *
 * Custom goals never add routing tags (Step 8 brief §4 Case C; documented rule): routing follows reported activities
 * and occupation context. The goal only shapes narrative personalization and feedback.
 */
import { createHash } from "node:crypto";
import { FINANCIAL_ACTIVITIES, OCCUPATIONS } from "@/content/profileOptions";
import {
  ACTIVITY_TAGS,
  CONTEXT_TAGS,
  PROFILE_ACTIVITY_TAGS,
  PROFILE_CONTEXT_TAG,
  type ActivityTag,
  type ContextTag,
} from "@/content/scenarios/templateSchema";
import type { ResolvedProfileTags } from "@/lib/domain/routing";

/** Bump when the classifier prompt or vocabulary changes: old cached interpretations are then not reused. */
export const CLASSIFIER_VERSION = "2026-11-step8.1";

export const NEUTRAL_CONTEXT: ContextTag = "general_consumer";

export interface RoutingProfile {
  occupation: string | null;
  customOccupation: string | null;
  financialActivities: readonly string[];
  customActivity: string | null;
}

/** A validated interpretation of custom text (Gemini, or deterministic when no call was needed). */
export interface ProfileInterpretation {
  status: "mapped" | "partial" | "unmapped";
  source: "gemini" | "exact_match" | "neutral";
  activityTags: ActivityTag[];
  contextTags: ContextTag[];
  /** Short neutral summary of the custom context for narrative personalization; never a vulnerability claim. */
  contextSummary: string | null;
}

/** Lower-case, punctuation-free, single-spaced text used for matching and fingerprints. */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[_/]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const VAGUE = new Set([
  "other",
  "others",
  "something",
  "something else",
  "something different",
  "else",
  "none",
  "nothing",
  "n a",
  "na",
  "misc",
  "miscellaneous",
  "various",
  "stuff",
  "things",
  "anything",
  "everything",
  "idk",
  "i don t know",
  "dont know",
  "don t know",
  "not sure",
  "unsure",
  "prefer not to say",
  "private",
  "unknown",
  "test",
  "asdf",
]);

/** True when a description carries no usable meaning (we then use neutral context instead of guessing). */
export function isVagueCustomText(text: string | null | undefined): boolean {
  if (!text) return true;
  const n = normalizeForMatch(text);
  if (n.length < 3 || !/\p{L}{2}/u.test(n)) return true;
  return VAGUE.has(n);
}

const ACTIVITY_BY_NAME = new Map<string, ActivityTag[]>();
for (const a of FINANCIAL_ACTIVITIES) {
  if (a.value === "other") continue;
  const tags = [...PROFILE_ACTIVITY_TAGS[a.value]];
  ACTIVITY_BY_NAME.set(normalizeForMatch(a.label), tags);
  ACTIVITY_BY_NAME.set(normalizeForMatch(a.value), tags);
}
for (const t of ACTIVITY_TAGS)
  if (!ACTIVITY_BY_NAME.has(normalizeForMatch(t))) ACTIVITY_BY_NAME.set(normalizeForMatch(t), [t]);

const CONTEXT_BY_NAME = new Map<string, ContextTag>();
for (const o of OCCUPATIONS) {
  if (o.value === "other") continue;
  CONTEXT_BY_NAME.set(normalizeForMatch(o.label), PROFILE_CONTEXT_TAG[o.value]);
  CONTEXT_BY_NAME.set(normalizeForMatch(o.value), PROFILE_CONTEXT_TAG[o.value]);
}

/** Exact predefined mapping of an "Other" activity description, or null. */
export function exactActivityMapping(text: string | null): ActivityTag[] | null {
  return text ? (ACTIVITY_BY_NAME.get(normalizeForMatch(text)) ?? null) : null;
}

/** Exact predefined mapping of an "Other" occupation description, or null. */
export function exactContextMapping(text: string | null): ContextTag | null {
  return text ? (CONTEXT_BY_NAME.get(normalizeForMatch(text)) ?? null) : null;
}

/** Tags from predefined selections only (no free text). */
export function predefinedTags(p: RoutingProfile): ResolvedProfileTags {
  const activityTags = new Set<ActivityTag>();
  for (const a of p.financialActivities) {
    const mapped = (PROFILE_ACTIVITY_TAGS as Record<string, readonly ActivityTag[]>)[a];
    for (const t of mapped ?? []) activityTags.add(t);
  }
  const contextTags: ContextTag[] = [];
  if (p.occupation && p.occupation !== "other") {
    const c = (PROFILE_CONTEXT_TAG as Record<string, ContextTag>)[p.occupation];
    if (c) contextTags.push(c);
  }
  return { activityTags: [...activityTags].sort(), contextTags };
}

/** The custom descriptions that actually influence routing (only while their "Other" option is selected). */
export function relevantCustomText(p: RoutingProfile): {
  occupation: string | null;
  activity: string | null;
} {
  return {
    occupation: p.occupation === "other" ? (p.customOccupation ?? null) : null,
    activity: p.financialActivities.includes("other") ? (p.customActivity ?? null) : null,
  };
}

export type InterpretationPlan =
  | { kind: "none" }
  /** Every relevant custom description was resolved deterministically (exact match or vague → neutral). */
  | { kind: "deterministic"; interpretation: ProfileInterpretation }
  /** At least one meaningful description needs Gemini; `fingerprint` keys the cache. */
  | {
      kind: "gemini";
      fingerprint: string;
      occupationText: string | null;
      activityText: string | null;
      /** Deterministic part (exact matches) to merge with Gemini's result. */
      partial: ProfileInterpretation;
    };

/** Stable cache key for the normalized relevant custom text (never stores or logs the raw text). */
export function interpretationFingerprint(
  occupationText: string | null,
  activityText: string | null,
): string {
  const payload = JSON.stringify({
    v: CLASSIFIER_VERSION,
    o: occupationText ? normalizeForMatch(occupationText) : null,
    a: activityText ? normalizeForMatch(activityText) : null,
  });
  return createHash("sha256").update(payload).digest("hex");
}

/** Decides whether Gemini is needed for this profile (Step 8 brief §4, §5). */
export function planInterpretation(p: RoutingProfile): InterpretationPlan {
  const custom = relevantCustomText(p);
  if (!custom.occupation && !custom.activity) return { kind: "none" };

  const activityTags: ActivityTag[] = [];
  const contextTags: ContextTag[] = [];
  let occupationText: string | null = null;
  let activityText: string | null = null;
  let resolvedAny = false;

  if (custom.occupation && !isVagueCustomText(custom.occupation)) {
    const exact = exactContextMapping(custom.occupation);
    if (exact) {
      contextTags.push(exact);
      resolvedAny = true;
    } else occupationText = custom.occupation;
  }
  if (custom.activity && !isVagueCustomText(custom.activity)) {
    const exact = exactActivityMapping(custom.activity);
    if (exact) {
      activityTags.push(...exact);
      resolvedAny = true;
    } else activityText = custom.activity;
  }

  const partial: ProfileInterpretation = {
    status: resolvedAny ? "mapped" : "unmapped",
    source: resolvedAny ? "exact_match" : "neutral",
    activityTags,
    contextTags,
    contextSummary: null,
  };
  if (!occupationText && !activityText) return { kind: "deterministic", interpretation: partial };
  return {
    kind: "gemini",
    fingerprint: interpretationFingerprint(occupationText, activityText),
    occupationText,
    activityText,
    partial,
  };
}

/** Predefined tags ∪ validated interpretation tags; neutral context when nothing else is known. */
export function combineTags(
  predefined: ResolvedProfileTags,
  interpretation: ProfileInterpretation | null,
): ResolvedProfileTags {
  const activities = new Set<ActivityTag>(predefined.activityTags);
  const contexts = new Set<ContextTag>(predefined.contextTags);
  for (const t of interpretation?.activityTags ?? []) if (ACTIVITY_TAGS.includes(t)) activities.add(t);
  for (const t of interpretation?.contextTags ?? []) if (CONTEXT_TAGS.includes(t)) contexts.add(t);
  if (contexts.size === 0) contexts.add(NEUTRAL_CONTEXT);
  return { activityTags: [...activities].sort(), contextTags: [...contexts].sort() };
}
