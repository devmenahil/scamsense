/**
 * Registry of the six scenario RENDERS (client-safe environment content). Parsed with Zod at import time, so an
 * invalid content edit fails the build and the tests (CLAUDE.md: content validated by Zod).
 *
 * Nothing here is secret, but it is still only sent to the browser through the attempt API, after token filling.
 */
import { SCENARIO_KEYS, type ScenarioKey } from "@/content/modules";
import type { ScenarioRules } from "@/lib/domain/scenarioStateMachine";
import { render as m1s1 } from "./m1-s1/render";
import { render as m1s2 } from "./m1-s2/render";
import { render as m2s1 } from "./m2-s1/render";
import { render as m2s2 } from "./m2-s2/render";
import { render as m3s1 } from "./m3-s1/render";
import { render as m3s2 } from "./m3-s2/render";
import { scenarioRenderSchema, type ScenarioRender } from "./schema";

const RAW = { "m1-s1": m1s1, "m1-s2": m1s2, "m2-s1": m2s1, "m2-s2": m2s2, "m3-s1": m3s1, "m3-s2": m3s2 };

export const SCENARIO_RENDERS = Object.fromEntries(
  SCENARIO_KEYS.map((key) => {
    const parsed = scenarioRenderSchema.parse(RAW[key]);
    if (parsed.scenarioKey !== key) throw new Error(`Render for ${key} declares ${parsed.scenarioKey}`);
    return [key, parsed];
  }),
) as Record<ScenarioKey, ScenarioRender>;

export function getScenarioRender(key: string): ScenarioRender | undefined {
  return (SCENARIO_RENDERS as Record<string, ScenarioRender>)[key];
}

/** The client-safe facts the state machine needs (no answer key). */
export function scenarioRules(render: ScenarioRender): ScenarioRules {
  return {
    actions: render.actions.map((a) => ({ id: a.id, kind: a.kind, requires: a.requires })),
    decisions: render.decisions.map((d) => ({ id: d.id, kind: d.kind, requires: d.requires })),
  };
}

/** Every anchor (stable element ID) in a render: values of `anchor` and `*Anchor` keys anywhere in the tree. */
export function collectAnchors(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const v of value) collectAnchors(v, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if ((k === "anchor" || k.endsWith("Anchor")) && typeof v === "string") out.push(v);
      else collectAnchors(v, out);
    }
  }
  return out;
}

/** Every `actionId`-style reference in a render (where the environment records an action). */
export function collectActionRefs(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const v of value) collectActionRefs(v, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k.endsWith("ActionId") || k === "actionId") {
        if (typeof v === "string") out.push(v);
      } else collectActionRefs(v, out);
    }
  }
  return out;
}

/** Every decision reference placed in the environment (`decisionId` / `decisionIds`). */
export function collectDecisionRefs(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const v of value) collectDecisionRefs(v, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if ((k === "decisionId" || k.endsWith("DecisionId")) && typeof v === "string") out.push(v);
      else if (k === "decisionIds" && Array.isArray(v)) out.push(...(v as string[]));
      else if (k !== "decisions") collectDecisionRefs(v, out);
    }
  }
  return out;
}
