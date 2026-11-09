"use client";

import { useRef, useState, type FormEvent } from "react";
import { countryName } from "@/content/countries";
import {
  AGE_BRACKETS,
  FINANCIAL_ACTIVITIES,
  FINANCIAL_GOALS,
  labelFor,
  OCCUPATIONS,
  PAYMENT_EXPERIENCE,
} from "@/content/profileOptions";
import { apiRequest } from "@/lib/api/client";
import { formatMoney, isSupportedCurrency } from "@/lib/domain/currency";
import { fieldErrors, profileInputSchema, type Profile } from "@/lib/profile/schema";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Icon } from "@/components/icons/Icon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FeedbackBanner } from "@/components/ui/FeedbackBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  AboutFields,
  ActivitiesFields,
  GoalsFields,
  valuesFromProfile,
  type ProfileFormErrors,
  type ProfileFormValues,
} from "./ProfileFields";

const NOT_PROVIDED = "Not provided";

/** My Profile: view saved details and edit them. Saves through PUT /api/profile (validated again on the server). */
export function ProfileManager({ initialProfile }: { initialProfile: Profile }) {
  const [profile, setProfile] = useState(initialProfile);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<ProfileFormValues>(() => valuesFromProfile(initialProfile));
  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  function startEditing() {
    setValues(valuesFromProfile(profile));
    setErrors({});
    setFormError(null);
    setSaved(false);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setErrors({});
    setFormError(null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = { ...values };
    const parsed = profileInputSchema.safeParse(payload);
    if (!parsed.success) {
      const found = fieldErrors(parsed.error) as ProfileFormErrors;
      setErrors(found);
      const first = Object.keys(found)[0];
      if (first) form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setErrors({});
    setFormError(null);
    setSaving(true);
    const result = await apiRequest<{ profile: Profile }>("/api/profile", { method: "PUT", body: payload });
    setSaving(false);
    if (!result.ok) {
      if (result.error.fields) setErrors(result.error.fields as ProfileFormErrors);
      setFormError(result.error.message);
      return;
    }
    setProfile(result.data.profile);
    setEditing(false);
    setSaved(true);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: "start" }));
  }

  const currency = isSupportedCurrency(profile.preferredCurrency) ? profile.preferredCurrency : "USD";
  const rows: { label: string; value: string }[] = [
    { label: "Display name", value: profile.displayName },
    {
      label: "Occupation or life stage",
      value:
        profile.occupation === "other" && profile.customOccupation
          ? `Other: ${profile.customOccupation}`
          : (labelFor(OCCUPATIONS, profile.occupation) ?? NOT_PROVIDED),
    },
    { label: "Country of residence", value: profile.country ? countryName(profile.country) : NOT_PROVIDED },
    { label: "Age bracket", value: labelFor(AGE_BRACKETS, profile.ageBracket) ?? NOT_PROVIDED },
    {
      label: "Digital payment experience",
      value: labelFor(PAYMENT_EXPERIENCE, profile.paymentExperience) ?? NOT_PROVIDED,
    },
    { label: "Financial goal", value: labelFor(FINANCIAL_GOALS, profile.financialGoal) ?? NOT_PROVIDED },
    { label: "About your goal", value: profile.customGoal ?? NOT_PROVIDED },
    {
      label: "Goal amount",
      value: profile.goalAmountMinor === null ? NOT_PROVIDED : formatMoney(profile.goalAmountMinor, currency),
    },
    { label: "Monthly income bracket", value: profile.incomeBracketLabel ?? NOT_PROVIDED },
  ];

  return (
    <div ref={topRef} className="scroll-mt-24">
      <PageHeader
        eyebrow="My Profile"
        title={profile.displayName}
        description="These details personalise your scenarios and feedback. They never change what counts as the right decision."
        actions={
          !editing && (
            <Button
              variant="secondary"
              onClick={startEditing}
              iconLeft={<Icon name="user" className="size-5" />}
            >
              Edit profile
            </Button>
          )
        }
      />

      {saved && (
        <FeedbackBanner tone="success" title="Profile saved." live className="mt-6">
          Your changes are stored and will be used from now on.
        </FeedbackBanner>
      )}

      {editing ? (
        <Card as="section" aria-labelledby="edit-heading" padding="lg" className="mt-8">
          <h2 id="edit-heading" className="text-subheading font-bold">
            Edit your profile
          </h2>
          {formError && (
            <div className="mt-4">
              <FeedbackBanner tone="look-again" title="Look again." live>
                {formError}
              </FeedbackBanner>
            </div>
          )}
          <form noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-10">
            <fieldset className="flex flex-col gap-6">
              <legend className="mb-4 font-heading text-lg font-extrabold">About you</legend>
              <AboutFields values={values} errors={errors} set={set} includeAgeBracket />
            </fieldset>
            <fieldset className="flex flex-col gap-6">
              <legend className="mb-4 font-heading text-lg font-extrabold">Your financial activities</legend>
              <ActivitiesFields values={values} errors={errors} set={set} />
            </fieldset>
            <fieldset className="flex flex-col gap-6">
              <legend className="mb-4 font-heading text-lg font-extrabold">Your financial goals</legend>
              <GoalsFields values={values} errors={errors} set={set} />
            </fieldset>
            <div className="flex flex-col-reverse gap-3 border-t-2 border-mist pt-5 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={cancel} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" loading={saving} loadingText="Saving…">
                Save changes
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_20rem]">
          <Card as="section" aria-labelledby="about-heading">
            <h2 id="about-heading" className="text-subheading font-bold">
              About you
            </h2>
            <dl className="mt-4 divide-y-2 divide-mist">
              {rows.map((r) => (
                <div key={r.label} className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
                  <dt className="text-small font-semibold">{r.label}</dt>
                  <dd className="break-words">{r.value}</dd>
                </div>
              ))}
              <div className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
                <dt className="text-small font-semibold">Financial activities</dt>
                <dd className="flex flex-wrap gap-2">
                  {profile.financialActivities.length === 0
                    ? NOT_PROVIDED
                    : profile.financialActivities.map((a) => (
                        <Badge key={a} tone="mist">
                          {labelFor(FINANCIAL_ACTIVITIES, a) ?? a}
                        </Badge>
                      ))}
                </dd>
              </div>
              {profile.customActivity && (
                <div className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
                  <dt className="text-small font-semibold">Other activity</dt>
                  <dd className="break-words">{profile.customActivity}</dd>
                </div>
              )}
            </dl>
          </Card>

          <div className="flex flex-col gap-5">
            <Card tone="mist" as="section" aria-labelledby="currency-heading">
              <h2 id="currency-heading" className="font-heading text-lg font-extrabold">
                Preferred currency
              </h2>
              <p className="mt-2 font-heading text-[1.75rem] leading-9 font-black">
                {profile.preferredCurrency}
              </p>
              <p className="mt-2 text-small">
                Changes apply from the next module you start. A module already in progress keeps its currency.
              </p>
            </Card>
            <Card as="section" aria-labelledby="privacy-heading">
              <h2
                id="privacy-heading"
                className="flex items-center gap-2 font-heading text-lg font-extrabold"
              >
                <Icon name="shield" className="size-5" />
                Your privacy
              </h2>
              <p className="mt-2 text-small text-teal/90">
                ScamSense collects only what it needs to personalise training. Your password is handled by our
                secure sign-in provider and never stored with your profile. ScamSense never asks for real
                one-time codes, card numbers, or bank details.
              </p>
            </Card>
            <SignOutButton />
          </div>
        </div>
      )}
    </div>
  );
}
