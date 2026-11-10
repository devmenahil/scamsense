"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { DecisionContent } from "@/content/scenarios/schema";
import type { RevealTarget } from "@/lib/review/locate";
import { isAvailable } from "@/lib/domain/scenarioStateMachine";

/**
 * Shared state for every simulated app. Apps never call the API themselves: they `record` in-environment actions and
 * `decide` through environment-native controls, and the scenario player talks to the server.
 *
 * Nothing in this context knows which actions or decisions are "right" (R10).
 */
export interface SimApi {
  /** Action IDs recorded so far (server-confirmed plus optimistic). */
  recorded: readonly string[];
  record: (actionId: string | undefined) => void;
  /** Opens the final-decision confirmation for a decision. */
  decide: (decisionId: string) => void;
  decisions: readonly DecisionContent[];
  /** False while a request is in flight or the attempt is not exploring. */
  interactive: boolean;
  openApp: (appId: string, pageId?: string) => void;
  /** A request for an app to show a page (set by `openApp`). `nonce` changes on every request. */
  navRequest: { appId: string; pageId?: string; nonce: number } | null;
  /**
   * Post-scenario review (Reveal the Red Flags, Step 9): the environment is read-only. `record` and `decide` do
   * nothing, decisions stay disabled, but in-simulation NAVIGATION (links, "Buy now" to view the checkout) works.
   */
  readOnly?: boolean;
  /** Review only: show the place where a piece of evidence lives (a thread, email, page, tab, or order). */
  reveal?: { appId: string; target: RevealTarget; nonce: number } | null;
}

/** Whether navigation-only controls may be used (during play, or in the read-only review). */
export function useCanNavigate(): boolean {
  const { interactive, readOnly } = useSim();
  return interactive || !!readOnly;
}

/** Runs `fn` when a review reveal request addresses this app (also on mount, for apps opened by the reveal). */
export function useReveal(appId: string, fn: (target: RevealTarget) => void) {
  const { reveal } = useSim();
  useEffect(() => {
    if (reveal && reveal.appId === appId) fn(reveal.target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal?.nonce]);
}

const Ctx = createContext<SimApi | null>(null);

export function SimProvider({ value, children }: { value: SimApi; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSim(): SimApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSim must be used inside <SimProvider>");
  return v;
}

/** Whether content gated by `requires` is visible now. */
export function useVisible(requires: readonly string[] | undefined): boolean {
  return isAvailable(requires, useSim().recorded);
}

/** Stable element ID for post-scenario review (Reveal the Red Flags). No styling difference, ever (R10). */
export function anchor(id: string | undefined): { "data-sim-anchor"?: string } {
  return id ? { "data-sim-anchor": id } : {};
}

/** Decision IDs from content that are currently available, in content order. */
export function useAvailableDecisions(ids: readonly string[]): DecisionContent[] {
  const { decisions, recorded } = useSim();
  return ids
    .map((id) => decisions.find((d) => d.id === id))
    .filter((d): d is DecisionContent => !!d && isAvailable(d.requires, recorded));
}
