import "server-only";
/**
 * SERVER-ONLY registry of the six complete scenario templates (Step 6 brief §5): render + answer key + rubric +
 * evidence + payment configuration + routing metadata. Never import this from a client component, and never
 * serialize a template (or any part of its answer key) into a response before the attempt is COMPLETED (R10, R15).
 */
import { getModule, getScenarioSlot, SCENARIO_KEYS, type ScenarioKey } from "@/content/modules";
import { EXPLANATION_MAX_CHARS, EXPLANATION_MIN_CHARS } from "@/lib/domain/scenarioStateMachine";
import { answerKey as m1s1 } from "./m1-s1/answerKey.server";
import { answerKey as m1s2 } from "./m1-s2/answerKey.server";
import { answerKey as m2s1 } from "./m2-s1/answerKey.server";
import { answerKey as m2s2 } from "./m2-s2/answerKey.server";
import { answerKey as m3s1 } from "./m3-s1/answerKey.server";
import { answerKey as m3s2 } from "./m3-s2/answerKey.server";
import { collectActionRefs, collectAnchors, collectDecisionRefs, SCENARIO_RENDERS } from "./renders";
import type { ScenarioRender } from "./schema";
import {
  authoredAnswerKeySchema,
  PERSONALIZATION_FIELDS,
  type AuthoredAnswerKey,
  type ScenarioTemplate,
} from "./templateSchema";

const RAW_KEYS = { "m1-s1": m1s1, "m1-s2": m1s2, "m2-s1": m2s1, "m2-s2": m2s2, "m3-s1": m3s1, "m3-s2": m3s2 };

export class TemplateError extends Error {
  constructor(key: string, message: string) {
    super(`[${key}] ${message}`);
    this.name = "TemplateError";
  }
}

/** Cross-checks the answer key against the render. Every failure is a content bug, so it throws. */
export function validateTemplateParts(render: ScenarioRender, key: AuthoredAnswerKey): void {
  const fail = (m: string) => {
    throw new TemplateError(render.scenarioKey, m);
  };
  if (key.scenarioKey !== render.scenarioKey) fail("answer key and render disagree on the scenario key");

  const actionIds = render.actions.map((a) => a.id);
  const decisionIds = render.decisions.map((d) => d.id);
  const anchors = collectAnchors(render.apps);
  const appIds = render.apps.map((a) => a.id);
  const unique = (list: string[], what: string) => {
    if (new Set(list).size !== list.length) fail(`duplicate ${what}`);
  };
  unique(actionIds, "action IDs");
  unique(decisionIds, "decision IDs");
  unique(anchors, "anchors");
  unique(appIds, "app IDs");
  if (actionIds.some((id) => decisionIds.includes(id))) fail("an ID is both an action and a decision");
  if (!appIds.includes(render.startAppId)) fail("startAppId is not an app");

  // Every action is reachable in the environment, and every referenced action exists.
  const refs = new Set(collectActionRefs(render.apps));
  for (const a of render.apps) {
    if (a.type === "messages" || a.type === "marketplace" || a.type === "seller_hub") {
      for (const t of a.threads) for (const b of t.branches) refs.add(b.actionId);
    }
  }
  for (const id of actionIds) if (!refs.has(id)) fail(`action ${id} is not placed in the environment`);
  for (const id of refs) if (!actionIds.includes(id)) fail(`environment references unknown action ${id}`);
  for (const a of render.actions)
    for (const r of a.requires ?? []) if (!actionIds.includes(r)) fail(`bad requires ${r}`);
  for (const d of render.decisions)
    for (const r of d.requires ?? []) if (!actionIds.includes(r)) fail(`bad requires ${r}`);

  // Every decision is placed in the environment (never shown as a list), and every placed decision exists.
  const placed = new Set(collectDecisionRefs(render.apps));
  for (const a of render.apps) if (a.type === "marketplace") placed.add(a.checkout.decisionId);
  for (const id of decisionIds) if (!placed.has(id)) fail(`decision ${id} has no control in the environment`);
  for (const id of placed)
    if (!decisionIds.includes(id)) fail(`environment references unknown decision ${id}`);

  // Answer key references.
  const rules = key.fixedCorrectDecisionRules;
  const correct = rules.flatMap((r) => r.decisionIds);
  for (const id of correct) if (!decisionIds.includes(id)) fail(`correct decision ${id} is unknown`);
  const ruleIds = rules.map((r) => r.ruleId);
  for (const e of key.evidenceDefinitions) {
    if (!anchors.includes(e.targetElementId)) fail(`evidence ${e.evidenceId} targets missing anchor`);
    for (const r of e.associatedCorrectDecisionRules) if (!ruleIds.includes(r)) fail(`unknown rule ${r}`);
  }
  unique(
    key.evidenceDefinitions.map((e) => e.evidenceId),
    "evidence IDs",
  );
  for (const v of key.verificationActions) {
    const a = render.actions.find((x) => x.id === v.actionId);
    if (!a) fail(`verification action ${v.actionId} is unknown`);
    else if (a.kind !== "investigate")
      fail(`verification action ${v.actionId} must be an investigate action`);
  }
  for (const id of key.unsafeActionIds) {
    if (!actionIds.includes(id) && !decisionIds.includes(id)) fail(`unsafe action ${id} is unknown`);
    if (correct.includes(id)) fail(`unsafe action ${id} is also a correct decision`);
  }
  const pay = render.decisions.filter((d) => d.kind === "pay").map((d) => d.id);
  if (pay.join() !== [...key.payableDecisionIds].join())
    fail("payable decisions must equal the pay-kind decisions");
  if (pay.length > 0 && !render.checkout) fail("a payable scenario needs checkout display details");
  if ((pay.length === 0) !== (key.paymentOutcome === "none")) fail("paymentOutcome doesn't match payability");
  const outcomes = Object.keys(key.fallbackContent.outcomeByDecision).sort();
  if (outcomes.join() !== [...decisionIds].sort().join()) fail("fallback outcome needed for every decision");
}

function buildTemplate(scenarioKey: ScenarioKey): ScenarioTemplate {
  const render = SCENARIO_RENDERS[scenarioKey];
  const key = authoredAnswerKeySchema.parse(RAW_KEYS[scenarioKey]);
  validateTemplateParts(render, key);
  const slot = getScenarioSlot(scenarioKey)!;
  const mod = getModule(slot.moduleKey)!;
  const branchActions = render.apps.flatMap((a) =>
    a.type === "messages" || a.type === "marketplace" || a.type === "seller_hub"
      ? a.threads.flatMap((t) => t.branches.map((b) => b.actionId))
      : [],
  );
  return {
    scenarioId: scenarioKey,
    moduleId: mod.key,
    title: slot.title,
    interfaceType: render.interfaceType,
    neutralIntroduction: render.introLine,
    difficulty: {
      moduleDifficulty: mod.difficulty,
      recommendedExperienceLevel: key.difficulty.recommendedExperienceLevel,
      interactionComplexity: key.difficulty.interactionComplexity,
      numberOfDecisionPoints: key.difficulty.numberOfDecisionPoints,
      requiredVerificationActions: key.verificationActions.map((v) => v.actionId),
    },
    primaryCategory: key.primaryCategory,
    secondaryCategoryTags: key.secondaryCategoryTags,
    learningObjectives: key.learningObjectives,
    activityTags: key.activityTags,
    contextTags: key.contextTags,
    supportedPersonalizationFields: PERSONALIZATION_FIELDS,
    personalizationSlots: render.slots,
    evidenceReferences: key.evidenceReferences,
    allowedActions: render.actions.map((a) => a.id),
    investigationActions: render.actions.filter((a) => a.kind === "investigate").map((a) => a.id),
    decisionOptions: render.decisions.map((d) => d.id),
    conversationBranches: branchActions,
    fixedScamStatus: key.fixedScamStatus,
    fixedCorrectDecisionRules: key.fixedCorrectDecisionRules,
    evidenceDefinitions: key.evidenceDefinitions,
    evaluationRubric: {
      correctDecisionIds: [...new Set(key.fixedCorrectDecisionRules.flatMap((r) => r.decisionIds))],
      evidence: key.evidenceDefinitions.map((e) => ({ id: e.evidenceId, weight: e.weight })),
      verificationActions: key.verificationActions.map((v) => ({ id: v.actionId, weight: v.weight })),
      unsafeActionIds: key.unsafeActionIds,
    },
    paymentConfiguration: {
      payableDecisionIds: key.payableDecisionIds,
      basisPoints: slot.paymentBasisPoints,
      amountSource: "module_starting_funds",
      outcome: key.paymentOutcome,
    },
    recoveryPolicyIds: key.recoveryPolicyIds,
    completionRequirements: {
      requiresFinalDecision: true,
      requiresExplanation: true,
      explanationMinChars: EXPLANATION_MIN_CHARS,
      explanationMaxChars: EXPLANATION_MAX_CHARS,
      payDecisionsRequireCheckoutResolution: key.payableDecisionIds.length > 0,
    },
    fallbackContent: {
      ...key.fallbackContent,
      personalizationDefaults: Object.fromEntries(render.slots.map((s) => [s.name, s.default])),
    },
    render,
  };
}

export const SCENARIO_TEMPLATES = Object.fromEntries(
  SCENARIO_KEYS.map((k) => [k, buildTemplate(k)]),
) as Record<ScenarioKey, ScenarioTemplate>;

export function getScenarioTemplate(key: string): ScenarioTemplate | undefined {
  return (SCENARIO_TEMPLATES as Record<string, ScenarioTemplate>)[key];
}
