"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { DecisionContent } from "@/content/scenarios/schema";
import { Icon } from "@/components/icons/Icon";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Input";
import { explanationPrompt } from "./prompts";

const draftKey = (attemptId: string) => `scamsense:explanation-draft:${attemptId}`;

function readDraft(attemptId: string): string {
  try {
    return window.sessionStorage.getItem(draftKey(attemptId)) ?? "";
  } catch {
    return "";
  }
}

export function clearDraft(attemptId: string) {
  try {
    window.sessionStorage.removeItem(draftKey(attemptId));
  } catch {
    /* storage unavailable: nothing to clear */
  }
}

/**
 * The required written explanation for the locked decision (R11, Step 6 brief §8): write → review → submit and lock.
 * Nothing about correctness appears here. The draft is kept in this tab only (sessionStorage), so a refresh doesn't
 * lose it; it is removed once submitted.
 */
export function ExplanationPanel({
  attemptId,
  decision,
  minChars,
  maxChars,
  isPay,
  submitting,
  error,
  onSubmit,
}: {
  attemptId: string;
  decision: DecisionContent;
  minChars: number;
  maxChars: number;
  isPay: boolean;
  submitting: boolean;
  error: string | null;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [step, setStep] = useState<"write" | "review">("write");
  const [fieldError, setFieldError] = useState<string>();
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setText(readDraft(attemptId));
    heading.current?.focus();
  }, [attemptId]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(draftKey(attemptId), text);
    } catch {
      /* storage unavailable: the draft just isn't kept across a refresh */
    }
  }, [attemptId, text]);

  const length = text.trim().length;

  function review(e: FormEvent) {
    e.preventDefault();
    if (length < minChars)
      return setFieldError(`Write at least ${minChars} characters so your reasoning can be reviewed.`);
    if (length > maxChars) return setFieldError(`Keep it under ${maxChars} characters.`);
    setFieldError(undefined);
    setStep("review");
  }

  return (
    <Card padding="lg" className="mx-auto max-w-2xl">
      <p className="label-eyebrow text-teal/80">Your final decision</p>
      <p className="mt-2 flex items-start gap-2 font-heading text-lg font-extrabold">
        <Icon name="lock" className="mt-1 size-5 shrink-0" />
        {decision.summary}
      </p>
      <h1 ref={heading} tabIndex={-1} className="mt-6 text-subheading font-bold focus-visible:outline-none">
        {explanationPrompt(decision)}
      </h1>

      {step === "write" ? (
        <form noValidate onSubmit={review} className="mt-4 flex flex-col gap-5">
          <Textarea
            label="Your reasoning"
            hint="Describe what you noticed and how it led to your decision. Feedback appears only after you submit."
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={maxChars}
            error={fieldError}
            rows={7}
            footer={
              <p className="text-right text-caption text-teal/80">
                {length} / {maxChars} characters (minimum {minChars})
              </p>
            }
          />
          <Button type="submit" size="lg" iconRight={<Icon name="arrow-right" className="size-5" />}>
            Review my answer
          </Button>
        </form>
      ) : (
        <div className="mt-4 flex flex-col gap-5">
          <div className="rounded-card border-2 border-mist bg-mist p-4">
            <p className="label-eyebrow text-teal/80">Your reasoning</p>
            <p className="mt-2 break-words whitespace-pre-line">{text.trim()}</p>
          </div>
          <p className="flex items-start gap-2 text-small">
            <Icon name="info" className="mt-0.5 size-4 shrink-0" />
            {isPay
              ? "When you submit, your decision and reasoning are locked and the PayPal Sandbox checkout opens next."
              : "When you submit, your decision and reasoning are locked for this attempt."}
          </p>
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-card bg-yellow-tint p-3 text-small">
              <Icon name="flag" className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button variant="secondary" onClick={() => setStep("write")} disabled={submitting}>
              Edit
            </Button>
            <Button size="lg" loading={submitting} loadingText="Saving…" onClick={() => onSubmit(text)}>
              Submit and lock
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
