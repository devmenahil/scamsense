"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/api/client";
import { resumeStep } from "@/lib/profile/mapping";
import {
  aboutStepSchema,
  activitiesStepSchema,
  fieldErrors,
  profileInputSchema,
  type Profile,
} from "@/lib/profile/schema";
import {
  AboutFields,
  ActivitiesFields,
  GoalsFields,
  valuesFromProfile,
  type ProfileFormErrors,
  type ProfileFormValues,
} from "@/components/profile/ProfileFields";
import { Icon } from "@/components/icons/Icon";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FeedbackBanner } from "@/components/ui/FeedbackBanner";
import { ProgressBar } from "@/components/ui/ProgressBar";

const STEPS = ["About you", "Your financial activities", "Your financial goals"] as const;

/**
 * Three-step onboarding (PRODUCT_SPEC §2.1). Steps 1 and 2 are saved to Supabase as the user continues (PATCH), so
 * a page refresh or a later sign-in resumes at the right step with answers prefilled. Step 3 saves the complete
 * profile (PUT), which marks onboarding as completed. Age confirmation and age bracket were collected at sign-up and
 * are not asked again.
 */
export function OnboardingForm({ initialProfile }: { initialProfile: Profile }) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState<number>(() => resumeStep(initialProfile));
  const [values, setValues] = useState<ProfileFormValues>(() => valuesFromProfile(initialProfile));
  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  function goTo(next: number) {
    setStep(next);
    setErrors({});
    setFormError(null);
    // Move focus to the new step's heading so keyboard and screen-reader users land in the right place.
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function focusFirstError(form: HTMLFormElement, found: ProfileFormErrors) {
    const first = Object.keys(found)[0];
    if (first) form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const schema = step === 0 ? aboutStepSchema : step === 1 ? activitiesStepSchema : profileInputSchema;
    const payload =
      step === 0
        ? { displayName: values.displayName, occupation: values.occupation, country: values.country }
        : step === 1
          ? { financialActivities: values.financialActivities, paymentExperience: values.paymentExperience }
          : {
              displayName: values.displayName,
              occupation: values.occupation,
              country: values.country,
              financialActivities: values.financialActivities,
              paymentExperience: values.paymentExperience,
              incomeBracket: values.incomeBracket,
              financialGoal: values.financialGoal,
              customGoal: values.customGoal,
              goalAmount: values.goalAmount,
              preferredCurrency: values.preferredCurrency,
            };

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      const found = fieldErrors(parsed.error) as ProfileFormErrors;
      setErrors(found);
      focusFirstError(form, found);
      return;
    }

    setErrors({});
    setFormError(null);
    setSaving(true);
    const result = await apiRequest<{ profile: Profile }>("/api/profile", {
      method: step < STEPS.length - 1 ? "PATCH" : "PUT",
      body: payload,
    });
    if (!result.ok) {
      setSaving(false);
      if (result.error.fields) {
        setErrors(result.error.fields as ProfileFormErrors);
        focusFirstError(form, result.error.fields as ProfileFormErrors);
      }
      setFormError(result.error.message);
      return;
    }

    if (step < STEPS.length - 1) {
      setSaving(false);
      goTo(step + 1);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  const isLast = step === STEPS.length - 1;

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

      {formError && (
        <div className="mt-4">
          <FeedbackBanner tone="look-again" title="Look again." live>
            {formError}
          </FeedbackBanner>
        </div>
      )}

      <form noValidate onSubmit={onSubmit} className="mt-5 flex flex-col gap-6">
        {step === 0 && <AboutFields values={values} errors={errors} set={set} />}
        {step === 1 && <ActivitiesFields values={values} errors={errors} set={set} />}
        {step === 2 && (
          <>
            <GoalsFields values={values} errors={errors} set={set} />
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
            <Button variant="secondary" onClick={() => goTo(step - 1)} disabled={saving}>
              Back
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <Button type="submit" loading={saving} loadingText={isLast ? "Saving your profile…" : "Saving…"}>
            {isLast ? "Finish setup" : "Continue"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
