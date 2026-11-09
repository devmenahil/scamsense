"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ClientAttemptView } from "@/lib/scenario/view";
import { apiRequest } from "@/lib/api/client";
import { EXPLORING_STATES, FINALIZED_STATES } from "@/lib/domain/scenarioStateMachine";
import { Icon, type IconName } from "@/components/icons/Icon";
import { TrainingIndicator } from "@/components/layout/TrainingIndicator";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Modal";
import { SimProvider, type SimApi } from "../sim/SimContext";
import { Workspace } from "../sim/Workspace";
import { CheckoutPanel } from "./CheckoutPanel";
import { clearDraft, ExplanationPanel } from "./ExplanationPanel";

type ClientEvent =
  | { type: "START" }
  | { type: "RECORD_ACTION"; actionId: string }
  | { type: "SELECT_DECISION"; decisionId: string }
  | { type: "CLEAR_DECISION" }
  | { type: "CONFIRM_DECISION" }
  | { type: "PAYMENT_CANCELLED" }
  | { type: "RETRY_PAYMENT" }
  | { type: "FINALIZE" };

const INTRO_ICON: Record<ClientAttemptView["render"]["interfaceType"], IconName> = {
  chat_email: "chat",
  web_browser: "mail",
  invoice: "invoice",
  marketplace: "marketplace",
};

/**
 * Runs one scenario attempt against the server-side state machine (Step 6): neutral intro → explore the environment
 * (actions recorded as they happen) → environment-native decision → "final decision" confirmation → required written
 * explanation → PayPal Sandbox checkout boundary (pay decisions) → locked. Every step is persisted, so a refresh
 * resumes exactly where the player was. No hint, score, or judgment appears at any point (R10).
 */
export function ScenarioPlayer({ initialView }: { initialView: ClientAttemptView }) {
  const [view, setView] = useState(initialView);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<string[]>([]);
  const [activeAppId, setActiveAppId] = useState(initialView.render.startAppId);
  const [navRequest, setNavRequest] = useState<SimApi["navRequest"]>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const base = `/api/attempts/${view.attemptId}`;

  const resync = useCallback(async () => {
    const r = await apiRequest<{ attempt: ClientAttemptView }>(base);
    if (r.ok) setView(r.data.attempt);
    setPendingActions([]);
  }, [base]);

  const send = useCallback(
    async (event: ClientEvent): Promise<boolean> => {
      setBusy(true);
      setNotice(null);
      const r = await apiRequest<{ attempt: ClientAttemptView }>(`${base}/events`, {
        method: "POST",
        body: event,
      });
      setBusy(false);
      if (r.ok) {
        setView(r.data.attempt);
        return true;
      }
      setNotice(r.error.message);
      if (r.error.code === "state_conflict") await resync();
      return false;
    },
    [base, resync],
  );

  const recorded = useMemo(
    () => [...view.recordedActionIds, ...pendingActions.filter((a) => !view.recordedActionIds.includes(a))],
    [view.recordedActionIds, pendingActions],
  );
  const exploring = (EXPLORING_STATES as readonly string[]).includes(view.state);

  const record = useCallback(
    (actionId: string | undefined) => {
      if (!actionId || recorded.includes(actionId) || !exploring) return;
      setPendingActions((p) => [...p, actionId]);
      // Actions are sent one at a time, in order, without blocking the environment.
      queue.current = queue.current.then(async () => {
        const r = await apiRequest<{ attempt: ClientAttemptView }>(`${base}/events`, {
          method: "POST",
          body: { type: "RECORD_ACTION", actionId },
        });
        if (r.ok) {
          setView(r.data.attempt);
          setPendingActions((p) => p.filter((x) => x !== actionId));
        } else {
          setNotice("We couldn't save your last step. Refreshing the scenario…");
          await resync();
        }
      });
    },
    [base, exploring, recorded, resync],
  );

  const sim: SimApi = {
    recorded,
    record,
    decide: (decisionId) => {
      // Let queued actions land first so the server sees them before the decision.
      void queue.current.then(() => send({ type: "SELECT_DECISION", decisionId }));
    },
    decisions: view.render.decisions,
    interactive: exploring && !busy,
    openApp: (appId, pageId) => {
      setActiveAppId(appId);
      setNavRequest((n) => ({ appId, pageId, nonce: (n?.nonce ?? 0) + 1 }));
    },
    navRequest,
  };

  const chosen = view.render.decisions.find((d) => d.id === (view.pendingDecisionId ?? view.decisionId));
  const finalized = (FINALIZED_STATES as readonly string[]).includes(view.state);
  const moduleHref = `/modules/${view.module.key}`;

  async function submitExplanation(text: string) {
    setBusy(true);
    setExplanationError(null);
    const r = await apiRequest<{ attempt: ClientAttemptView }>(`${base}/justification`, {
      method: "POST",
      body: { text },
    });
    setBusy(false);
    if (r.ok) {
      clearDraft(view.attemptId);
      setView(r.data.attempt);
      window.scrollTo({ top: 0 });
    } else {
      setExplanationError(r.error.message);
      if (r.error.code === "state_conflict") await resync();
    }
  }

  return (
    <div className="container-page py-6 sm:py-8">
      {/* Player bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href={moduleHref}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-pill pr-3 font-heading font-extrabold hover:underline"
          >
            <Icon name="close" className="size-5" />
            Exit
          </Link>
          <p className="min-w-0 truncate font-heading font-extrabold">
            Module {view.module.order} · {view.title}
          </p>
          {view.isPractice && (
            <Badge tone="outline" icon={<Icon name="target" className="size-3.5" />}>
              Practice attempt {view.attemptNumber}
            </Badge>
          )}
        </div>
        <TrainingIndicator />
      </div>

      {notice && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-card bg-yellow-tint p-3 text-small">
          <Icon name="flag" className="mt-0.5 size-4 shrink-0" />
          {notice}
        </p>
      )}

      {view.state === "INTRO" && (
        <Card padding="lg" className="mx-auto max-w-xl text-center">
          <span className="mx-auto inline-flex size-16 items-center justify-center rounded-card bg-mist">
            <Icon name={INTRO_ICON[view.render.interfaceType]} accent className="size-8" />
          </span>
          {/* Neutral, one-line introduction only (R9). */}
          <h1 className="mt-5 text-subheading font-bold">{view.introLine}</h1>
          {view.isPractice && (
            <p className="mt-3 text-small">
              This is a practice replay. It never changes your official score, progress, badges, or Training
              Funds.
            </p>
          )}
          <p className="mt-3 text-caption text-teal/85">
            Fictional scenario · never enter real passwords, codes, or card numbers · there is no timer.
          </p>
          <Button className="mt-6" size="lg" loading={busy} onClick={() => void send({ type: "START" })}>
            Begin
          </Button>
        </Card>
      )}

      {(exploring || view.state === "DECISION_SELECTED") && (
        <>
          <h1 className="sr-only">Scenario: {view.introLine}</h1>
          <SimProvider value={sim}>
            <Workspace apps={view.render.apps} activeAppId={activeAppId} onSelectApp={setActiveAppId} />
          </SimProvider>
          <p className="mt-3 text-center text-caption text-teal/85">
            Fictional scenario · explore as much as you like · your final decision is made inside the apps.
          </p>
        </>
      )}

      {view.state === "EXPLANATION_REQUIRED" && chosen && (
        <ExplanationPanel
          attemptId={view.attemptId}
          decision={chosen}
          minChars={view.explanation.minChars}
          maxChars={view.explanation.maxChars}
          isPay={chosen.kind === "pay"}
          submitting={busy}
          error={explanationError}
          onSubmit={(t) => void submitExplanation(t)}
        />
      )}

      {(view.state === "PAYMENT_PENDING" ||
        view.state === "PAYMENT_CANCELLED" ||
        view.state === "PAYMENT_COMPLETED") && (
        <CheckoutPanel
          view={view}
          busy={busy}
          onCancel={() => void send({ type: "PAYMENT_CANCELLED" })}
          onRetry={() => void send({ type: "RETRY_PAYMENT" })}
          onFinishWithoutPaying={() => setConfirmFinish(true)}
        />
      )}

      {finalized && chosen && (
        <Card padding="lg" className="mx-auto max-w-2xl" as="section" aria-labelledby="locked-title">
          <p className="label-eyebrow text-teal/80">
            {view.state === "COMPLETED" ? "Completed" : "Decision locked"}
          </p>
          <h1 id="locked-title" className="mt-1 text-subheading font-bold">
            Your answer is saved
          </h1>
          <p className="mt-4 flex items-start gap-2 font-heading text-lg font-extrabold">
            <Icon name="lock" className="mt-1 size-5 shrink-0" />
            {chosen.summary}
          </p>
          {view.justification && (
            <div className="mt-4 rounded-card bg-mist p-4">
              <p className="label-eyebrow text-teal/80">Your reasoning</p>
              <p className="mt-2 break-words whitespace-pre-line">{view.justification}</p>
            </div>
          )}
          <p className="mt-5 flex items-start gap-2 text-small">
            <Icon name="info" className="mt-0.5 size-4 shrink-0" />
            {view.state === "COMPLETED"
              ? "This attempt is complete."
              : "Your feedback, Reveal the Red Flags, and Your Recovery Playbook for this attempt are added in a later build step. Nothing about this attempt can change now."}
          </p>
          <div className="mt-6 flex justify-center">
            <ButtonLink href={moduleHref} iconRight={<Icon name="arrow-right" className="size-5" />}>
              Back to module
            </ButtonLink>
          </div>
        </Card>
      )}

      <Dialog
        open={view.state === "DECISION_SELECTED" && !!chosen}
        onClose={() => {
          // The native dialog also fires "close" when it closes after a confirmation; only an explicit
          // "Keep exploring" while the decision is still selected returns to the environment.
          if (view.state === "DECISION_SELECTED" && !busy) void send({ type: "CLEAR_DECISION" });
        }}
        onConfirm={() => void send({ type: "CONFIRM_DECISION" })}
        loading={busy}
        title="This will be your final decision"
        description={
          chosen ? (
            <>
              You chose: <strong className="font-heading font-extrabold">{chosen.summary}</strong>. You
              can&apos;t change it afterwards. Next, you&apos;ll explain your reasoning.
            </>
          ) : undefined
        }
        confirmLabel="Confirm decision"
        cancelLabel="Keep exploring"
      >
        {chosen?.kind === "pay" && (
          <p className="rounded-card bg-mist p-3 text-small">
            After your explanation, a PayPal Sandbox checkout opens for this payment (test money only).
          </p>
        )}
      </Dialog>

      <Dialog
        open={confirmFinish}
        onClose={() => setConfirmFinish(false)}
        onConfirm={() => {
          setConfirmFinish(false);
          void send({ type: "FINALIZE" });
        }}
        title="Finish without paying?"
        description="Your decision and reasoning stay as submitted, and the attempt is finalized with no payment made."
        confirmLabel="Finish without paying"
        cancelLabel="Go back"
      />
    </div>
  );
}
