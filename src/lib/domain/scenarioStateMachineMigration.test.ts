import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLIENT_EVENT_TYPES,
  MAX_EVENTS_PER_ATTEMPT,
  SCENARIO_STATES,
  SERVER_EVENT_TYPES,
  STATE_TRANSITIONS,
} from "./scenarioStateMachine";

/** Guards drift between the TypeScript state machine and the Step 6 migration (add a NEW migration to change it). */
const sql = readFileSync(
  join(__dirname, "..", "..", "..", "supabase", "migrations", "20261110090000_scenario_engine.sql"),
  "utf8",
);
const quoted = (s: string) => [...s.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
const between = (start: string, end: string) => {
  const i = sql.indexOf(start);
  if (i < 0) throw new Error(`${start} not found`);
  return sql.slice(i, sql.indexOf(end, i));
};

describe("scenario engine migration matches the TypeScript state machine", () => {
  it("states", () => {
    expect(quoted(between("constraint scenario_attempts_state_check", ";"))).toEqual([...SCENARIO_STATES]);
  });

  it("legal transitions", () => {
    const body = between("function public.scenario_state_transition_allowed", "$$;");
    const flat = quoted(body.slice(body.indexOf("in (")));
    const pairs = [];
    for (let i = 0; i < flat.length; i += 2) pairs.push(`${flat[i]}>${flat[i + 1]}`);
    expect(pairs.sort()).toEqual(STATE_TRANSITIONS.map(([f, t]) => `${f}>${t}`).sort());
  });

  it("event types", () => {
    expect(
      quoted(
        between(
          "constraint scenario_attempt_events_type_check",
          "constraint scenario_attempt_events_ids_check",
        ),
      ).sort(),
    ).toEqual([...CLIENT_EVENT_TYPES, ...SERVER_EVENT_TYPES].sort());
  });

  it("event cap", () => {
    expect(sql).toContain(`>= ${MAX_EVENTS_PER_ATTEMPT} then`);
  });

  it("never grants writes or functions to browser roles", () => {
    expect(sql).not.toMatch(/grant\s+(insert|update|delete|all)[^;]*to\s+[^;]*(anon|authenticated)/i);
    expect(sql).not.toMatch(/grant\s+execute[^;]*to\s+[^;]*(anon|authenticated)/i);
    expect(sql).not.toMatch(/create policy[^;]*for\s+(insert|update|delete|all)/i);
  });
});
