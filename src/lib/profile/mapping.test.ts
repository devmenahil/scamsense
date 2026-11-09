import { describe, expect, it } from "vitest";
import { draftToRow, inputToRow, resumeStep, rowToProfile, type ProfileRow } from "./mapping";
import { profileInputSchema } from "./schema";

const row: ProfileRow = {
  display_name: "Lee",
  age_bracket: null,
  occupation: null,
  country: null,
  financial_activities: [],
  payment_experience: null,
  income_bracket: null,
  income_bracket_label: null,
  financial_goal: null,
  custom_goal: null,
  goal_amount_minor: null,
  preferred_currency: "USD",
  onboarding_completed: false,
  created_at: "2026-11-09T00:00:00Z",
  updated_at: "2026-11-09T00:00:00Z",
};

describe("profile mapping", () => {
  it("maps a fresh row and resumes at step 1", () => {
    const p = rowToProfile(row);
    expect(p.displayName).toBe("Lee");
    expect(p.financialActivities).toEqual([]);
    expect(resumeStep(p)).toBe(0);
  });

  it("resumes at the first incomplete step", () => {
    expect(resumeStep(rowToProfile({ ...row, occupation: "student", country: "US" }))).toBe(1);
    expect(
      resumeStep(
        rowToProfile({
          ...row,
          occupation: "student",
          country: "US",
          financial_activities: ["investments"],
          payment_experience: "new",
        }),
      ),
    ).toBe(2);
  });

  it("converts bigint strings to numbers", () => {
    expect(rowToProfile({ ...row, goal_amount_minor: "150000" }).goalAmountMinor).toBe(150_000);
  });

  it("never writes user_id and marks onboarding complete on a full save", () => {
    const input = profileInputSchema.parse({
      displayName: "Lee",
      occupation: "retired",
      country: "CA",
      financialActivities: ["online_shopping"],
      paymentExperience: "new",
      incomeBracket: "prefer_not_to_say",
      financialGoal: "vacation_travel",
      customGoal: "",
      goalAmount: "",
      preferredCurrency: "USD",
    });
    const r = inputToRow(input);
    expect(r).not.toHaveProperty("user_id");
    expect(r).not.toHaveProperty("age_bracket"); // untouched unless provided
    expect(r.onboarding_completed).toBe(true);
    expect(r.preferred_currency).toBe("USD");
    expect(draftToRow({ country: "US" })).toEqual({ country: "US" });
  });
});
