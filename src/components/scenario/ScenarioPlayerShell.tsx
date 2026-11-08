"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons/Icon";
import { TrainingIndicator } from "@/components/layout/TrainingIndicator";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { Textarea } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Modal";
import { DemoEmailClient, type EnvironmentDecision } from "./DemoEmailClient";

const JUSTIFICATION_MIN = 20;
const JUSTIFICATION_MAX = 1000;

type Phase = "intro" | "exploring" | "justifying";

/**
 * Scenario player shell: neutral intro → explore → environment-native decision → final-decision confirmation →
 * required written reasoning (PRODUCT_SPEC §4.1). Phase 1 runs entirely in the browser with demo content and stores
 * nothing. The server-side state machine, attempt APIs, and PayPal Sandbox checkout replace this in Phases 4–5.
 */
export function ScenarioPlayerShell({
  attemptId,
  introLine,
  moduleHref,
  context,
}: {
  attemptId: string;
  introLine: string;
  moduleHref: string;
  context: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [pending, setPending] = useState<EnvironmentDecision | null>(null);
  const [decision, setDecision] = useState<EnvironmentDecision | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const justifyHeading = useRef<HTMLHeadingElement>(null);

  function confirmDecision() {
    if (!pending) return;
    setDecision(pending);
    setPending(null);
    setPhase("justifying");
    requestAnimationFrame(() => justifyHeading.current?.focus());
  }

  function submitJustification(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (trimmed.length < JUSTIFICATION_MIN) {
      setError(`Write at least ${JUSTIFICATION_MIN} characters so your reasoning can be reviewed.`);
      return;
    }
    if (trimmed.length > JUSTIFICATION_MAX) {
      setError(`Keep it under ${JUSTIFICATION_MAX} characters.`);
      return;
    }
    setError(undefined);
    setSubmitting(true);
    router.push(`/play/${attemptId}/results`);
  }

  return (
    <div className="container-page py-6 sm:py-10">
      {/* Player bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={moduleHref}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-pill pr-3 font-heading font-extrabold hover:underline"
          >
            <Icon name="close" className="size-5" />
            Exit
          </Link>
          <p className="truncate font-heading font-extrabold">{context}</p>
        </div>
        <TrainingIndicator />
      </div>

      {phase === "intro" && (
        <Card padding="lg" className="mx-auto max-w-xl text-center">
          <span className="mx-auto inline-flex size-16 items-center justify-center rounded-card bg-mist">
            <Icon name="mail" accent className="size-8" />
          </span>
          {/* Neutral, one-line introduction only (R9). */}
          <h1 className="mt-5 text-subheading font-bold">{introLine}</h1>
          <p className="mt-3 text-caption text-teal/85">
            Fictional scenario · never enter real passwords, codes, or card numbers. There is no timer.
          </p>
          <Button className="mt-6" size="lg" onClick={() => setPhase("exploring")}>
            Begin
          </Button>
        </Card>
      )}

      {phase === "exploring" && (
        <>
          <h1 className="sr-only">Scenario: {introLine}</h1>
          <DemoEmailClient onDecision={setPending} />
          <p className="mt-3 text-center text-caption text-teal/85">
            Fictional scenario · never enter real passwords, codes, or card numbers.
          </p>
        </>
      )}

      {phase === "justifying" && decision && (
        <Card padding="lg" className="mx-auto max-w-2xl">
          <p className="label-eyebrow text-teal/80">Your final decision</p>
          <p className="mt-2 flex items-center gap-2 font-heading text-lg font-extrabold">
            <Icon name="lock" className="size-5" />
            {decision.label}
          </p>
          <h1
            ref={justifyHeading}
            tabIndex={-1}
            className="mt-6 text-subheading font-bold focus-visible:outline-none"
          >
            Why did you make this decision?
          </h1>
          <form noValidate onSubmit={submitJustification} className="mt-4 flex flex-col gap-5">
            <Textarea
              label="Your reasoning"
              hint="Describe what you noticed and why it led to your choice. Feedback appears after you submit."
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={JUSTIFICATION_MAX}
              error={error}
              rows={6}
              footer={
                <p className="text-right text-caption text-teal/80">
                  {text.trim().length} / {JUSTIFICATION_MAX} characters (minimum {JUSTIFICATION_MIN})
                </p>
              }
            />
            <Button type="submit" size="lg" loading={submitting} loadingText="Reviewing your reasoning…">
              Submit reasoning
            </Button>
          </form>
        </Card>
      )}

      <DemoNotice className="mx-auto mt-6 max-w-2xl">
        This is a demonstration environment. Your choices and reasoning are not saved, and no payment runs.
      </DemoNotice>

      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={confirmDecision}
        title="This will be your final decision"
        description={
          pending ? (
            <>
              You chose <strong className="font-heading font-extrabold">{pending.label}</strong>. You
              can&apos;t change it afterwards. Next you&apos;ll explain your reasoning.
            </>
          ) : undefined
        }
        confirmLabel="Confirm decision"
        cancelLabel="Keep exploring"
      >
        {pending?.kind === "pay" && (
          <p className="rounded-card bg-mist p-3 text-small">
            In the full simulation, this opens a PayPal Sandbox checkout with test money. This shell runs no
            checkout.
          </p>
        )}
      </Dialog>
    </div>
  );
}
