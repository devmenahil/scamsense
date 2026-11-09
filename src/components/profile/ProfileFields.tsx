"use client";

import { COUNTRY_OPTIONS } from "@/content/countries";
import {
  AGE_BRACKETS,
  CUSTOM_ACTIVITY_MAX,
  CUSTOM_GOAL_MAX,
  CUSTOM_OCCUPATION_MAX,
  DISPLAY_NAME_MAX,
  FINANCIAL_ACTIVITIES,
  FINANCIAL_GOALS,
  INCOME_BRACKETS,
  OCCUPATIONS,
  PAYMENT_EXPERIENCE,
} from "@/content/profileOptions";
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY, getCurrency, minorToMajorString } from "@/lib/domain/currency";
import type { Profile } from "@/lib/profile/schema";
import { ChoiceChip, FieldError, Input, Select } from "@/components/ui/Input";

/**
 * Profile form field groups shared by onboarding (one group per step) and My Profile (all groups). Values are kept
 * as strings for the inputs; the shared Zod schemas convert them (blank → null, amount → minor units).
 */
export interface ProfileFormValues {
  displayName: string;
  ageBracket: string;
  occupation: string;
  customOccupation: string;
  country: string;
  financialActivities: string[];
  customActivity: string;
  paymentExperience: string;
  incomeBracket: string;
  financialGoal: string;
  customGoal: string;
  goalAmount: string;
  preferredCurrency: string;
}

export type ProfileFormErrors = Partial<Record<keyof ProfileFormValues | "form", string>>;

export function valuesFromProfile(p: Profile): ProfileFormValues {
  const currency = p.preferredCurrency || DEFAULT_CURRENCY;
  return {
    displayName: p.displayName,
    ageBracket: p.ageBracket ?? "",
    occupation: p.occupation ?? "",
    customOccupation: p.customOccupation ?? "",
    country: p.country ?? "",
    financialActivities: [...p.financialActivities],
    customActivity: p.customActivity ?? "",
    paymentExperience: p.paymentExperience ?? "",
    incomeBracket: p.incomeBracket ?? "",
    financialGoal: p.financialGoal ?? "",
    customGoal: p.customGoal ?? "",
    goalAmount: p.goalAmountMinor === null ? "" : minorToMajorString(p.goalAmountMinor, currency),
    preferredCurrency: currency,
  };
}

interface GroupProps {
  values: ProfileFormValues;
  errors: ProfileFormErrors;
  set: <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => void;
}

const SKIP = { value: "", label: "Prefer not to say" };

function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <p className="text-right text-caption text-teal/80" aria-live="polite">
      {value.length} / {max}
    </p>
  );
}

export function AboutFields({
  values,
  errors,
  set,
  includeAgeBracket = false,
}: GroupProps & { includeAgeBracket?: boolean }) {
  return (
    <>
      <Input
        label="Display name"
        name="displayName"
        hint="Shown on your certificate and in feedback."
        value={values.displayName}
        onChange={(e) => set("displayName", e.target.value)}
        autoComplete="nickname"
        maxLength={DISPLAY_NAME_MAX}
        error={errors.displayName}
      />
      <Select
        label="Occupation or life stage"
        name="occupation"
        hint="Choose the one that best describes you."
        placeholder="Choose one"
        options={OCCUPATIONS}
        value={values.occupation}
        onChange={(e) => set("occupation", e.target.value)}
        error={errors.occupation}
      />
      {values.occupation === "other" && (
        <Input
          label="Describe your occupation or life stage"
          name="customOccupation"
          hint="A short phrase is enough, like “Digital artist” or “Caring for family”."
          value={values.customOccupation}
          onChange={(e) => set("customOccupation", e.target.value)}
          maxLength={CUSTOM_OCCUPATION_MAX}
          error={errors.customOccupation}
          footer={<CharCount value={values.customOccupation} max={CUSTOM_OCCUPATION_MAX} />}
        />
      )}
      <Select
        label="Country of residence"
        name="country"
        placeholder="Choose your country"
        options={COUNTRY_OPTIONS}
        value={values.country}
        onChange={(e) => set("country", e.target.value)}
        autoComplete="country"
        error={errors.country}
      />
      {includeAgeBracket && (
        <Select
          label="Age bracket"
          name="ageBracket"
          optional
          options={[SKIP, ...AGE_BRACKETS]}
          value={values.ageBracket}
          onChange={(e) => set("ageBracket", e.target.value)}
          error={errors.ageBracket}
        />
      )}
    </>
  );
}

export function ActivitiesFields({ values, errors, set }: GroupProps) {
  return (
    <>
      <fieldset aria-describedby={errors.financialActivities ? "activities-error" : "activities-hint"}>
        <legend className="font-heading text-base font-bold">Financial activities</legend>
        <p id="activities-hint" className="mt-1 text-caption text-teal/85">
          Pick everything you do. This shapes which situations you practise.
        </p>
        <div className="mt-3 flex flex-wrap gap-2.5">
          {FINANCIAL_ACTIVITIES.map((a) => (
            <ChoiceChip
              key={a.value}
              name="financialActivities"
              value={a.value}
              label={a.label}
              checked={values.financialActivities.includes(a.value)}
              onChange={(checked) =>
                set(
                  "financialActivities",
                  checked
                    ? [...values.financialActivities, a.value]
                    : values.financialActivities.filter((v) => v !== a.value),
                )
              }
            />
          ))}
        </div>
        {errors.financialActivities && (
          <div className="mt-2">
            <FieldError id="activities-error">{errors.financialActivities}</FieldError>
          </div>
        )}
      </fieldset>
      {values.financialActivities.includes("other") && (
        <Input
          label="Describe your other financial activity"
          name="customActivity"
          hint="For example: “I sell digital art commissions through social media.”"
          value={values.customActivity}
          onChange={(e) => set("customActivity", e.target.value)}
          maxLength={CUSTOM_ACTIVITY_MAX}
          error={errors.customActivity}
          footer={<CharCount value={values.customActivity} max={CUSTOM_ACTIVITY_MAX} />}
        />
      )}
      <Select
        label="Digital payment experience"
        name="paymentExperience"
        placeholder="Choose one"
        options={PAYMENT_EXPERIENCE}
        value={values.paymentExperience}
        onChange={(e) => set("paymentExperience", e.target.value)}
        error={errors.paymentExperience}
      />
    </>
  );
}

export function GoalsFields({ values, errors, set }: GroupProps) {
  const currency = CURRENCY_OPTIONS.some((c) => c.value === values.preferredCurrency)
    ? getCurrency(values.preferredCurrency)
    : getCurrency(DEFAULT_CURRENCY);
  return (
    <>
      <Select
        label="Financial goal"
        name="financialGoal"
        placeholder="Choose one"
        options={FINANCIAL_GOALS}
        value={values.financialGoal}
        onChange={(e) => set("financialGoal", e.target.value)}
        error={errors.financialGoal}
      />
      <Input
        label={values.financialGoal === "other" ? "Describe your goal" : "Anything to add about your goal?"}
        name="customGoal"
        optional={values.financialGoal !== "other"}
        value={values.customGoal}
        onChange={(e) => set("customGoal", e.target.value)}
        maxLength={CUSTOM_GOAL_MAX}
        error={errors.customGoal}
        footer={<CharCount value={values.customGoal} max={CUSTOM_GOAL_MAX} />}
      />
      <Select
        label="Preferred currency"
        name="preferredCurrency"
        hint="Used for your fictional training funds and PayPal Sandbox checkouts. More currencies may be added after Sandbox testing."
        options={CURRENCY_OPTIONS}
        value={values.preferredCurrency}
        onChange={(e) => set("preferredCurrency", e.target.value)}
        error={errors.preferredCurrency}
      />
      <Input
        label={`Goal amount (${currency.code})`}
        name="goalAmount"
        optional
        inputMode={currency.minorUnitDigits === 0 ? "numeric" : "decimal"}
        hint="Roughly how much your goal costs. Only used to make examples feel familiar."
        value={values.goalAmount}
        onChange={(e) => set("goalAmount", e.target.value)}
        maxLength={20}
        error={errors.goalAmount}
      />
      <Select
        label="Monthly income bracket"
        name="incomeBracket"
        optional
        hint="Never an exact amount. Used later to size an illustrative, fictional training budget."
        options={[{ value: "", label: "Skip this question" }, ...INCOME_BRACKETS]}
        value={values.incomeBracket}
        onChange={(e) => set("incomeBracket", e.target.value)}
        error={errors.incomeBracket}
      />
    </>
  );
}
