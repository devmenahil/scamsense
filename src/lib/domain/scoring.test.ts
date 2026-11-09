import { describe, expect, it } from "vitest";
import {
  isValidStoredScore,
  MAX_SCENARIO_POINTS,
  SCORE_WEIGHTS,
  scoreScenario,
  ScoringError,
  type ScoringRubric,
} from "./scoring";

/** Test fixture only. Real rubrics live in server-only answer keys (Phase 4). */
const rubric: ScoringRubric = {
  correctDecisionIds: ["verify_in_official_app", "report"],
  evidence: [
    { id: "ev.sender", weight: 3 },
    { id: "ev.url", weight: 2 },
    { id: "ev.urgency", weight: 1 },
  ],
  verificationActions: [
    { id: "act.inspect_sender", weight: 2 },
    { id: "act.view_url", weight: 1 },
    { id: "act.open_official_app", weight: 1 },
  ],
  unsafeActionIds: ["pay_invoice", "submit_card_details"],
};

const reasoning = (ids: string[]) => ({ source: "fallback" as const, addressedEvidenceIds: ids });

describe("deterministic scoring (40 / 30 / 20 / 10)", () => {
  it("weights sum to 100", () => {
    expect(SCORE_WEIGHTS).toEqual({ decision: 40, reasoning: 30, verification: 20, paymentSafety: 10 });
    expect(MAX_SCENARIO_POINTS).toBe(100);
  });

  it("awards full marks for a correct, well-reasoned, verified, safe attempt", () => {
    const s = scoreScenario(
      rubric,
      {
        decisionId: "report",
        verificationActionIds: ["act.inspect_sender", "act.view_url", "act.open_official_app"],
        actionIds: [],
      },
      reasoning(["ev.sender", "ev.url", "ev.urgency"]),
    );
    expect(s).toMatchObject({
      decisionCorrect: true,
      decisionPoints: 40,
      reasoningPoints: 30,
      verificationPoints: 20,
      paymentSafetyPoints: 10,
      totalPoints: 100,
    });
    expect(isValidStoredScore(s)).toBe(true);
  });

  it("scores each component independently with weighted, half-up rounding", () => {
    const s = scoreScenario(
      rubric,
      { decisionId: "verify_in_official_app", verificationActionIds: ["act.view_url"], actionIds: [] },
      reasoning(["ev.url"]), // 2 of 6 weight → 10
    );
    expect(s.reasoningPoints).toBe(10);
    expect(s.verificationPoints).toBe(5); // 1 of 4 weight → 5
    expect(s.totalPoints).toBe(40 + 10 + 5 + 10);

    const t = scoreScenario(
      rubric,
      { decisionId: "report", verificationActionIds: ["act.inspect_sender"], actionIds: [] },
      reasoning(["ev.urgency"]), // 1 of 6 → 5
    );
    expect(t.reasoningPoints).toBe(5);
    expect(t.verificationPoints).toBe(10); // 2 of 4 → 10
  });

  it("gives no decision or payment-safety points for an unsafe payment", () => {
    const s = scoreScenario(
      rubric,
      { decisionId: "pay_invoice", verificationActionIds: [], actionIds: [] },
      reasoning([]),
    );
    expect(s).toMatchObject({
      decisionPoints: 0,
      reasoningPoints: 0,
      verificationPoints: 0,
      paymentSafetyPoints: 0,
    });
    expect(s.totalPoints).toBe(0);
  });

  it("detects unsafe actions taken during play even when the final decision was safe", () => {
    const s = scoreScenario(
      rubric,
      { decisionId: "report", verificationActionIds: [], actionIds: ["submit_card_details"] },
      reasoning([]),
    );
    expect(s.decisionPoints).toBe(40);
    expect(s.paymentSafetyPoints).toBe(0);
  });

  it("ignores unknown and duplicate IDs (AI may only reference answer-key evidence)", () => {
    const s = scoreScenario(
      rubric,
      { decisionId: "report", verificationActionIds: ["act.made_up", "act.view_url"], actionIds: [] },
      reasoning(["ev.invented", "ev.sender", "ev.sender"]),
    );
    expect(s.addressedEvidenceIds).toEqual(["ev.sender"]);
    expect(s.verificationActionIds).toEqual(["act.view_url"]);
    expect(s.reasoningPoints).toBe(15); // 3 of 6
  });

  it("is deterministic and records its source and version", () => {
    const behavior = { decisionId: "report", verificationActionIds: ["act.view_url"], actionIds: [] };
    const a = scoreScenario(rubric, behavior, reasoning(["ev.url"]));
    const b = scoreScenario(rubric, behavior, reasoning(["ev.url"]));
    expect(a).toEqual(b);
    expect(
      scoreScenario(rubric, behavior, { source: "gemini", addressedEvidenceIds: [] }).reasoningSource,
    ).toBe("gemini");
    expect(a.scoringVersion).toMatch(/\S/);
  });

  it("rejects invalid rubrics", () => {
    const behavior = { decisionId: "x", verificationActionIds: [], actionIds: [] };
    expect(() => scoreScenario({ ...rubric, correctDecisionIds: [] }, behavior, reasoning([]))).toThrow(
      ScoringError,
    );
    expect(() => scoreScenario({ ...rubric, evidence: [] }, behavior, reasoning([]))).toThrow(ScoringError);
    expect(() => scoreScenario({ ...rubric, verificationActions: [] }, behavior, reasoning([]))).toThrow(
      ScoringError,
    );
    expect(() => scoreScenario({ ...rubric, unsafeActionIds: ["report"] }, behavior, reasoning([]))).toThrow(
      ScoringError,
    );
  });

  it("validates stored score rows", () => {
    const ok = {
      decisionPoints: 40,
      reasoningPoints: 12,
      verificationPoints: 7,
      paymentSafetyPoints: 10,
      totalPoints: 69,
    };
    expect(isValidStoredScore(ok)).toBe(true);
    expect(isValidStoredScore({ ...ok, totalPoints: 70 })).toBe(false);
    expect(isValidStoredScore({ ...ok, decisionPoints: 20, totalPoints: 49 })).toBe(false);
    expect(isValidStoredScore({ ...ok, reasoningPoints: 31, totalPoints: 88 })).toBe(false);
  });
});
