/**
 * Recovery Playbook personalization: Gemini output contract and validation (Step 9). Pure.
 *
 * Gemini only writes a short note connecting the learner's own decision to the lesson, and may choose up to three
 * of the Playbook's existing step IDs to put first. It never writes policy: the note may not mention PayPal or any
 * protection, dispute, refund, eligibility, coverage, deadline, procedure, number, link, email address, or statistic.
 * Anything like that is rejected and the authored Playbook is shown unchanged (the policy facts on the page always
 * come from the verified knowledge base, whatever Gemini says).
 */
import { z } from "zod";
import { InvalidOutputError } from "@/lib/ai/errors";

export const NOTE_MAX = 420;

export interface PlaybookNote {
  note: string;
  emphasisStepIds: string[];
}

const rawSchema = z.object({
  scenarioId: z.string(),
  note: z.string().trim().min(40).max(NOTE_MAX),
  emphasisStepIds: z.array(z.string()).min(1).max(3),
});

/** Policy and outcome vocabulary Gemini may not use (policy facts come only from the verified library, R21, R30). */
const POLICY_WORDS =
  /paypal|protection|protected|dispute|claim|refund|reimburs|money[- ]?back|guarantee|eligib|entitle|cover(ed|age|s)?\b|resolution cent|chargeback|deadline|time ?frame|within|business days|\bdays?\b|\bhours?\b|\bweeks?\b|\bmonths?\b|law|legal|liab|policy|policies|terms|agreement|insur|compensat|recover (your|the) (money|funds)|get (your|the) money back/i;
const DIGITS = /\d/;
const CONTACT = /https?:|www\.|@|[a-z0-9-]+\.(com|net|org|io|gov|example)\b/i;
const MOCKING =
  /\b(stupid|dumb|idiot|moron|gullible|naive|foolish|clueless|loser|pathetic|shame on|should have known)\b/i;
const STATISTICS = /\bpercent\b|\bmillion\b|\bbillion\b|statistic|most people|majority of/i;

export class PlaybookOutputError extends InvalidOutputError {}

export function parsePlaybookNote(
  raw: unknown,
  ctx: { scenarioKey: string; stepIds: readonly string[] },
): PlaybookNote {
  const r = rawSchema.safeParse(raw);
  if (!r.success) throw new PlaybookOutputError("shape");
  const v = r.data;
  if (v.scenarioId !== ctx.scenarioKey) throw new PlaybookOutputError("scenario");
  for (const [re, why] of [
    [POLICY_WORDS, "policy"],
    [DIGITS, "digits"],
    [CONTACT, "contact"],
    [MOCKING, "mocking"],
    [STATISTICS, "statistics"],
  ] as const)
    if (re.test(v.note)) throw new PlaybookOutputError(why);
  const emphasis = [...new Set(v.emphasisStepIds)].filter((id) => ctx.stepIds.includes(id));
  if (emphasis.length === 0) throw new PlaybookOutputError("steps");
  return { note: v.note, emphasisStepIds: emphasis };
}

export function playbookJsonSchema(scenarioKey: string, stepIds: readonly string[]) {
  return {
    type: "object",
    properties: {
      scenarioId: { type: "string", enum: [scenarioKey] },
      note: { type: "string", description: "2–3 friendly sentences, no policy, no numbers, no links." },
      emphasisStepIds: {
        type: "array",
        items: { type: "string", enum: [...stepIds] },
        minItems: 1,
        maxItems: 3,
      },
    },
    required: ["scenarioId", "note", "emphasisStepIds"],
    additionalProperties: false,
  };
}
