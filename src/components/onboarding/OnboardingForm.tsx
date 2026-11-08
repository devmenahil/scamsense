"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import {
  CURRENCIES_PLACEHOLDER,
  FINANCIAL_ACTIVITIES,
  FINANCIAL_GOALS,
  INCOME_BRACKETS,
  LIFE_STAGES,
  PAYMENT_EXPERIENCE,
} from "@/content/profileOptions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChoiceChip, FieldError, Input, Select } from "@/components/ui/Input";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Icon } from "@/components/icons/Icon";

const STEPS = ["About you", "Your money habits", "Preferences"] as const;
const GOAL_NOTE_MAX = 120;

interface Profile {
  displayName: string;
  lifeStage: string;
  paymentExperience: string;
  activities: string[];
  goal: string;
  goalNote: string;
  income: string;
  currency: string;
}

type Errors = Partial<Record<keyof Profile, string>>;

function validateStep(step: number, p: Profile): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (p.displayName.trim().length < 2) e.displayName = "Enter the name you'd like on your certificate.";
    if (!p.lifeStage) e.lifeStage = "Choose the option closest to you.";
    if (!p.paymentExperience) e.paymentExperience = "Choose how often you use digital payments.";
  }
  if (step === 1) {
    if (p.activities.length === 0) e.activities = "Pick at least one activity.";
    if (!p.goal) e.goal = "Choose a goal.";
    if (p.goalNote.length > GOAL_NOTE_MAX) e.goalNote = `Keep it under ${GOAL_NOTE_MAX} characters.`;
  }
  if (step === 2 && !p.currency) e.currency = "Choose a currency.";
  return e;
}

/**
 * Onboarding shell (PRODUCT_SPEC §2.1). Collects only what personalisation needs (R3). Phase 1 keeps answers in
 * memory only; `PUT /api/profile` persists them in Phase 2. Age bracket + 18+ confirmation are collected at sign-up.
 */
export function OnboardingForm() {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [finishing, setFinishing] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    displayName: "",
    lifeStage: "",
    paymentExperience: "",
    activities: [],
    goal: "",
    goalNote: "",
    income: "prefer_not",
    currency: "USD",
  });

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }));

  function goTo(next: number) {
    setStep(next);
    setErrors({});
    // Move focus to the new step's heading so keyboard and screen-reader users land in the right place.
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const stepErrors = validateStep(step, profile);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    if (step < STEPS.length - 1) {
      goTo(step + 1);
      return;
    }
    setFinishing(true);
    router.push("/dashboard");
  }

  return (
    <Card padding="lg" className="mx-auto w-full max-w-2xl">
      <ProgressBar
        value={step + 1}
        max={STEPS.length}
        label="Profile setup"
        valueText={`Step ${step + 1} of ${STEPS.length}`}
      />
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mt-6 text-subheading font-bold focus-visible:outline-none"
      >
        {STEPS[step]}
      </h2>

      <form noValidate onSubmit={onSubmit} className="mt-5 flex flex-col gap-6">
        {step === 0 && (
          <>
            <Input
              label="Display name"
              hint="Shown on your certificate and in feedback."
              value={profile.displayName}
              onChange={(e) => set("displayName", e.target.value)}
              autoComplete="nickname"
              maxLength={60}
              error={errors.displayName}
            />
            <Select
              label="Profession or life stage"
              placeholder="Choose one"
              options={LIFE_STAGES}
              value={profile.lifeStage}
              onChange={(e) => set("lifeStage", e.target.value)}
              error={errors.lifeStage}
            />
            <Select
              label="Digital payment experience"
              placeholder="Choose one"
              options={PAYMENT_EXPERIENCE}
              value={profile.paymentExperience}
              onChange={(e) => set("paymentExperience", e.target.value)}
              error={errors.paymentExperience}
            />
          </>
        )}

        {step === 1 && (
          <>
            <fieldset aria-describedby={errors.activities ? "activities-error" : undefined}>
              <legend className="font-heading text-base font-bold">Financial activities</legend>
              <p className="mt-1 text-caption text-teal/85">
                Pick everything you do. This shapes your scenarios.
              </p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {FINANCIAL_ACTIVITIES.map((a) => (
                  <ChoiceChip
                    key={a.value}
                    name="activities"
                    value={a.value}
                    label={a.label}
                    checked={profile.activities.includes(a.value)}
                    onChange={(checked) =>
                      set(
                        "activities",
                        checked
                          ? [...profile.activities, a.value]
                          : profile.activities.filter((v) => v !== a.value),
                      )
                    }
                  />
                ))}
              </div>
              {errors.activities && (
                <div className="mt-2">
                  <FieldError id="activities-error">{errors.activities}</FieldError>
                </div>
              )}
            </fieldset>
            <Select
              label="Financial goal"
              placeholder="Choose one"
              options={FINANCIAL_GOALS}
              value={profile.goal}
              onChange={(e) => set("goal", e.target.value)}
              error={errors.goal}
            />
            <Input
              label="Tell us more about your goal"
              optional
              value={profile.goalNote}
              onChange={(e) => set("goalNote", e.target.value)}
              maxLength={GOAL_NOTE_MAX}
              error={errors.goalNote}
              footer={
                <p className="text-right text-caption text-teal/80" aria-live="polite">
                  {profile.goalNote.length} / {GOAL_NOTE_MAX}
                </p>
              }
            />
            <Select
              label="Income bracket"
              optional
              options={INCOME_BRACKETS}
              value={profile.income}
              onChange={(e) => set("income", e.target.value)}
            />
          </>
        )}

        {step === 2 && (
          <>
            <Select
              label="Preferred currency"
              hint="Used for your fictional training funds and PayPal Sandbox checkouts. More currencies arrive with the PayPal integration."
              options={CURRENCIES_PLACEHOLDER}
              value={profile.currency}
              onChange={(e) => set("currency", e.target.value)}
              error={errors.currency}
            />
            <div className="flex items-start gap-3 rounded-card bg-mist p-4 text-small">
              <Icon name="shield" className="mt-0.5 size-5" />
              <p>
                Your answers only personalise scenario details and feedback wording. They never change what
                counts as the right decision.
              </p>
            </div>
          </>
        )}

        <div className="flex flex-col-reverse gap-3 border-t-2 border-mist pt-5 sm:flex-row sm:justify-between">
          {step > 0 ? (
            <Button variant="secondary" onClick={() => goTo(step - 1)}>
              Back
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <Button type="submit" loading={finishing} loadingText="Opening dashboard…">
            {step < STEPS.length - 1 ? "Continue" : "Finish setup"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
