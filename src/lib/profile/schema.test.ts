import { describe, expect, it } from "vitest";
import { signUpSchema } from "@/lib/auth/schema";
import { aboutStepSchema, activitiesStepSchema, profileDraftSchema, profileInputSchema } from "./schema";

const valid = {
  displayName: "  Priya  ",
  occupation: "freelancer",
  country: "GB",
  financialActivities: ["freelance_payments", "receiving_invoices"],
  paymentExperience: "frequent",
  incomeBracket: "",
  financialGoal: "buying_laptop",
  customGoal: "",
  goalAmount: "1,250.50",
  preferredCurrency: "USD",
};

describe("profileInputSchema", () => {
  it("accepts a complete profile, trims, converts blanks to null and the amount to minor units", () => {
    const out = profileInputSchema.parse(valid);
    expect(out.displayName).toBe("Priya");
    expect(out.incomeBracket).toBeNull();
    expect(out.customGoal).toBeNull();
    expect(out.goalAmountMinor).toBe(125_050);
    expect(out).not.toHaveProperty("goalAmount");
  });

  it("allows every optional field to be skipped", () => {
    const out = profileInputSchema.parse({ ...valid, goalAmount: "", incomeBracket: "", customGoal: "" });
    expect(out.goalAmountMinor).toBeNull();
    expect(out.ageBracket).toBeUndefined();
  });

  it("requires the required fields", () => {
    const r = profileInputSchema.safeParse({
      ...valid,
      occupation: "",
      country: "",
      financialActivities: [],
      paymentExperience: "",
      financialGoal: "",
    });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path[0]);
    for (const f of ["occupation", "country", "financialActivities", "paymentExperience", "financialGoal"]) {
      expect(paths).toContain(f);
    }
  });

  it("rejects unsupported currencies", () => {
    // GBP/EUR/AUD/CAD are PayPal currencies but not enabled until merchant verification.
    for (const c of ["GBP", "EUR", "AUD", "CAD", "JPY", "BTC", "usd", ""]) {
      const r = profileInputSchema.safeParse({ ...valid, preferredCurrency: c, goalAmount: "" });
      expect(r.success, c).toBe(false);
      expect(r.error!.issues[0]!.path[0]).toBe("preferredCurrency");
    }
  });

  it("rejects unknown option ids, duplicates, and bad amounts", () => {
    expect(profileInputSchema.safeParse({ ...valid, occupation: "astronaut" }).success).toBe(false);
    expect(profileInputSchema.safeParse({ ...valid, country: "XX" }).success).toBe(false);
    expect(profileInputSchema.safeParse({ ...valid, financialActivities: ["gambling"] }).success).toBe(false);
    expect(
      profileInputSchema.safeParse({ ...valid, financialActivities: ["investments", "investments"] }).success,
    ).toBe(false);
    expect(profileInputSchema.safeParse({ ...valid, goalAmount: "-10" }).success).toBe(false);
    expect(profileInputSchema.safeParse({ ...valid, goalAmount: "0" }).success).toBe(false);
    expect(profileInputSchema.safeParse({ ...valid, goalAmount: "99999999999" }).success).toBe(false);
    expect(profileInputSchema.safeParse({ ...valid, customGoal: "x".repeat(121) }).success).toBe(false);
  });

  it("rejects attempts to set ownership or server-controlled fields", () => {
    for (const extra of [{ user_id: "someone-else" }, { userId: "x" }, { onboardingCompleted: false }]) {
      expect(profileInputSchema.safeParse({ ...valid, ...extra }).success).toBe(false);
      expect(profileDraftSchema.safeParse({ displayName: "A", ...extra }).success).toBe(false);
    }
  });
});

describe("onboarding step schemas", () => {
  it("validate each step independently", () => {
    expect(
      aboutStepSchema.safeParse({ displayName: "A", occupation: "student", country: "US" }).success,
    ).toBe(true);
    expect(aboutStepSchema.safeParse({ displayName: "", occupation: "student", country: "US" }).success).toBe(
      false,
    );
    expect(
      activitiesStepSchema.safeParse({ financialActivities: ["online_shopping"], paymentExperience: "new" })
        .success,
    ).toBe(true);
    expect(
      activitiesStepSchema.safeParse({ financialActivities: [], paymentExperience: "new" }).success,
    ).toBe(false);
  });

  it("the draft schema does not accept step-3 fields", () => {
    expect(profileDraftSchema.safeParse({ preferredCurrency: "USD" }).success).toBe(false);
  });
});

describe("signUpSchema", () => {
  const base = {
    displayName: "Sam",
    email: " Sam@Example.com ",
    password: "correct horse",
    ageConfirmed: true,
  };

  it("requires the age confirmation", () => {
    expect(signUpSchema.safeParse(base).success).toBe(true);
    const r = signUpSchema.safeParse({ ...base, ageConfirmed: false });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.message).toMatch(/at least 18/);
    expect(signUpSchema.safeParse({ ...base, ageConfirmed: undefined }).success).toBe(false);
  });

  it("normalizes email and keeps the age bracket optional", () => {
    const out = signUpSchema.parse({ ...base, ageBracket: null });
    expect(out.email).toBe("sam@example.com");
    expect(out.ageBracket).toBeNull();
    expect(signUpSchema.safeParse({ ...base, ageBracket: "16_17" }).success).toBe(false);
  });

  it("enforces password length", () => {
    expect(signUpSchema.safeParse({ ...base, password: "short" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...base, password: "x".repeat(73) }).success).toBe(false);
  });
});
