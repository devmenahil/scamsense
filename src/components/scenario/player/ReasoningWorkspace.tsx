"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { ClientAttemptView } from "@/lib/scenario/view";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/Icon";
import { SimProvider, type SimApi } from "../sim/SimContext";
import { Workspace } from "../sim/Workspace";

const noop = () => {};

/**
 * The read-only sim API for the reasoning step. Exported for tests: it must never record, decide, or be interactive.
 * `recorded` is the learner's OWN recorded actions only, so the environment shows exactly what they had unlocked
 * (no extra content, unlike the post-completion review), and no evidence is marked (no `reveal`).
 */
export function readOnlySim(
  view: Pick<ClientAttemptView, "recordedActionIds" | "render">,
  openApp: (appId: string) => void,
): SimApi {
  return {
    recorded: [...view.recordedActionIds],
    record: noop,
    decide: noop,
    decisions: view.render.decisions,
    interactive: false,
    readOnly: true,
    openApp,
    navRequest: null,
    reveal: null,
  };
}

/**
 * Post-decision reasoning screen (split view). Left: the scenario exactly as the learner played it (same personalized
 * render, same unlocked content), READ-ONLY: navigation and reading work, but nothing is recorded or decided and no
 * request is sent from it. Right: the locked decision and the existing explanation form (children).
 * The server enforces the same thing: in EXPLANATION_REQUIRED only SUBMIT_EXPLANATION is a legal event.
 *
 * Desktop/tablet (md+): two columns, each scrolling on its own. Phones: two tabs; both panels stay mounted, so typed
 * reasoning is never lost when switching (the draft is also kept in sessionStorage by ExplanationPanel).
 */
export function ReasoningWorkspace({ view, children }: { view: ClientAttemptView; children: ReactNode }) {
  const [activeAppId, setActiveAppId] = useState(view.render.startAppId);
  const [tab, setTab] = useState<"reasoning" | "scenario">("reasoning");
  const sim = useMemo(() => readOnlySim(view, setActiveAppId), [view]);

  const tabButton = (id: "reasoning" | "scenario", label: string, icon: "report" | "search") => (
    <button
      type="button"
      role="tab"
      id={`reasoning-tab-${id}`}
      aria-controls={`reasoning-panel-${id}`}
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-tile px-3 font-heading text-small font-extrabold aria-selected:bg-white aria-selected:shadow-edge-sm"
    >
      <Icon name={icon} className="size-4" />
      {label}
    </button>
  );

  return (
    <div>
      {/* Phones only: switch between the reasoning form and the read-only scenario. */}
      <div
        role="tablist"
        aria-label="Reasoning or scenario"
        className="mb-4 flex gap-1 rounded-card bg-mist p-1 md:hidden"
      >
        {tabButton("reasoning", "Your reasoning", "report")}
        {tabButton("scenario", "Review scenario", "search")}
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section
          id="reasoning-panel-scenario"
          aria-labelledby="readonly-scenario-heading"
          className={cn(
            "min-w-0 md:sticky md:top-4 md:block md:max-h-[calc(100dvh-2rem)] md:overflow-y-auto",
            tab === "scenario" ? "block" : "hidden",
          )}
        >
          <div className="mb-3 flex items-start gap-2 rounded-card border-2 border-teal/25 bg-mist p-3">
            <Icon name="lock" className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0">
              <h2 id="readonly-scenario-heading" className="font-heading font-extrabold">
                Your scenario · read-only
              </h2>
              <p className="text-small">
                Look back at everything you saw. You can switch apps, scroll, and open messages and pages, but
                nothing here changes your decision or is recorded.
              </p>
            </div>
          </div>
          <SimProvider value={sim}>
            <Workspace apps={view.render.apps} activeAppId={activeAppId} onSelectApp={setActiveAppId} />
          </SimProvider>
        </section>

        <section
          id="reasoning-panel-reasoning"
          aria-label="Your decision and reasoning"
          className={cn(
            "min-w-0 md:sticky md:top-4 md:block md:max-h-[calc(100dvh-2rem)] md:overflow-y-auto",
            tab === "reasoning" ? "block" : "hidden",
          )}
        >
          {children}
        </section>
      </div>
    </div>
  );
}
