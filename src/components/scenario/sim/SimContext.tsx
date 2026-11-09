"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DecisionContent } from "@/content/scenarios/schema";
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
