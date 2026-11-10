/**
 * Sensei Kenshi — structured output and its deterministic guards (Step 10). Pure.
 *
 * Gemini returns `{ reply, citedPolicyIds, followUps }`. Before anything reaches the learner the reply is rejected
 * (→ one retry, then a friendly error; nothing is fabricated) when it:
 *   • names a scenario the learner hasn't completed together with a verdict word (answer-protection backstop: the
 *     model never receives those answers, but must not guess either);
 *   • invents policy: a deadline/timeframe not written in a retrieved VERIFIED fact, percentages or statistics,
 *     refund/coverage promises;
 *   • contains links, URLs, phone numbers, or email addresses (other than phishing@paypal.com from a verified fact);
 *   • asks the learner for credentials or private financial details.
 * Cited policy IDs are whitelisted to the records actually retrieved for this question; follow-ups go through the
 * same leak guard and are dropped individually when they fail.
 */
import { z } from "zod";
import { InvalidOutputError } from "@/lib/ai/errors";
import { MAX_REPLY_CHARS } from "./prompt";

export interface KenshiOutput {
  reply: string;
  citedPolicyIds: string[];
  followUps: string[];
}

export function kenshiJsonSchema(policyIds: readonly string[]): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      reply: { type: "string", maxLength: MAX_REPLY_CHARS },
      citedPolicyIds: {
        type: "array",
        items: policyIds.length ? { type: "string", enum: [...policyIds] } : { type: "string" },
        maxItems: 4,
      },
      followUps: { type: "array", items: { type: "string", maxLength: 90 }, maxItems: 3 },
    },
    required: ["reply", "citedPolicyIds", "followUps"],
  };
}

const raw = z.object({
  reply: z
    .string()
    .trim()
    .min(1)
    .max(MAX_REPLY_CHARS + 200),
  citedPolicyIds: z.array(z.string()).default([]),
  followUps: z.array(z.string()).default([]),
});

const VERDICT =
  /\b(scam|scams|scammer|fraud|fraudulent|legit|legitimate|genuine|real|fake|safe|unsafe|trust(worthy)?|red flags?|warning signs?|suspicious|correct (answer|decision|choice)|right (answer|decision|choice))\b/i;

/** Sentences of `text` (rough split, good enough for a guard). */
function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/);
}

/** True when the text names an unfinished scenario in the same sentence as a verdict word. */
export function leaksUnfinished(text: string, notCompletedTitles: readonly string[]): boolean {
  const titles = notCompletedTitles.map((t) => t.toLowerCase().replace(/^the\s+/, ""));
  return sentences(text).some((s) => {
    const lower = s.toLowerCase().replace(/[’]/g, "'");
    return titles.some((t) => lower.includes(t)) && VERDICT.test(s);
  });
}

const NUMBER_WORDS =
  "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen|fifteen|twenty|thirty|forty|forty-five|sixty|ninety|hundred|eighty";
const WORD_VALUES: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fourteen: 14,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  "forty-five": 45,
  sixty: 60,
  ninety: 90,
};
// Deadlines and timeframes ("within 180 days", "30-day", "two weeks"). Global so every mention is checked.
const TIMEFRAMES: RegExp[] = [
  /\b\d+\s*(?:-|–|to)?\s*\d*\s*(?:-\s*)?(?:business\s+|calendar\s+)?(?:day|days|week|weeks|month|months|year|years|hour|hours)\b/gi,
  new RegExp(
    `\\b(?:${NUMBER_WORDS})[\\s-]+(?:business\\s+|calendar\\s+)?(?:day|days|week|weeks|month|months)\\b`,
    "gi",
  ),
];
const POLICY_INVENTION: RegExp[] = [
  // statistics
  /\d\s*%|\bper ?cent\b|\bpercentage of\b/i,
  // refund / coverage promises (negated forms such as "isn't guaranteed" or "no guarantee" are allowed)
  /(?<!\b(?:not|never|no|n't|nothing|without|isn't|aren't|can't|cannot)\s+(?:a\s+|any\s+)?)\bguarantee[sd]?\b/i,
  /\byou\s*(?:'ll|will)\s+(?:definitely\s+|certainly\s+|always\s+)?(?:get|receive)\s+(?:a\s+|your\s+|a\s+full\s+)?(?:refund|money\s+back|reimburse)/i,
  /\byou\s*(?:'re|are)\s+(?:definitely\s+|fully\s+|automatically\s+)?(?:covered|eligible|protected|entitled)\b/i,
  /\bwill\s+(?:definitely\s+|certainly\s+)?be\s+(?:fully\s+)?(?:refunded|reimbursed|covered)\b/i,
];

/** "180 days", "thirty-day", "2 weeks" → "180 day" / "30 day" / "2 week"; null when it isn't one simple timeframe. */
function timeframeKey(phrase: string): string | null {
  const m = phrase
    .toLowerCase()
    .match(/^(\d+|[a-z]+(?:-five)?)[\s-]+(?:business\s+|calendar\s+)?(day|week|month|year|hour)s?$/);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]!) ? Number(m[1]) : WORD_VALUES[m[1]!];
  return n === undefined ? null : `${n} ${m[2]}${/business/.test(phrase.toLowerCase()) ? " business" : ""}`;
}

/** Timeframes that appear in the VERIFIED facts retrieved for this question (the only ones Kenshi may repeat). */
export function verifiedTimeframes(facts: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const f of facts)
    for (const r of TIMEFRAMES)
      for (const m of f.matchAll(r)) {
        const k = timeframeKey(m[0].trim());
        if (k) out.add(k);
      }
  return out;
}

/**
 * True when the text invents policy: statistics, refund/coverage promises, or any deadline/timeframe that is not
 * written in one of the verified facts retrieved for this question (`allowedTimeframes`, from verifiedTimeframes).
 */
export function inventsPolicy(text: string, allowedTimeframes: ReadonlySet<string> = new Set()): boolean {
  if (POLICY_INVENTION.some((r) => r.test(text))) return true;
  for (const r of TIMEFRAMES)
    for (const m of text.matchAll(r)) {
      const k = timeframeKey(m[0].trim());
      if (!k || !allowedTimeframes.has(k)) return true;
    }
  return false;
}

const LINKS = /https?:\/\/|\bwww\.|\b[a-z0-9-]+\.(?:com|net|org|gov|io|co|us)\b(?!@)/i;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/gi;
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/;
const CREDENTIAL_REQUEST =
  /\b(?:send|share|tell|give|type|enter|paste|provide)\s+(?:me|us|it to me)\b[^.?!]{0,40}\b(?:password|passcode|code|pin|card|account number|routing|bank|otp|login|ssn|social security)/i;

export function hasForbiddenContact(text: string): boolean {
  const emails = (text.match(EMAIL) ?? []).filter(
    (e) => e.toLowerCase().replace(/[.,;:]+$/, "") !== "phishing@paypal.com",
  );
  if (emails.length > 0) return true;
  // Strip the one allowed address before the link check so "paypal.com" inside it isn't counted as a link.
  const withoutEmail = text.replace(/phishing@paypal\.com/gi, "");
  return LINKS.test(withoutEmail) || PHONE.test(text);
}

export function parseKenshiOutput(
  value: unknown,
  ctx: {
    policyIds: readonly string[];
    notCompletedTitles: readonly string[];
    /** Verified fact texts retrieved for this question; their timeframes may be repeated, no others. */
    verifiedFacts?: readonly string[];
  },
): KenshiOutput {
  const allowed = verifiedTimeframes(ctx.verifiedFacts ?? []);
  const r = raw.safeParse(value);
  if (!r.success) throw new InvalidOutputError("shape");
  const reply = r.data.reply
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (reply.length > MAX_REPLY_CHARS + 100) throw new InvalidOutputError("too long");
  if (leaksUnfinished(reply, ctx.notCompletedTitles)) throw new InvalidOutputError("unfinished scenario");
  if (inventsPolicy(reply, allowed)) throw new InvalidOutputError("policy invention");
  if (hasForbiddenContact(reply)) throw new InvalidOutputError("links or contact details");
  if (CREDENTIAL_REQUEST.test(reply)) throw new InvalidOutputError("credential request");
  const citedPolicyIds = [...new Set(r.data.citedPolicyIds)].filter((id) => ctx.policyIds.includes(id));
  const followUps = r.data.followUps
    .map((f) => f.replace(/\s+/g, " ").trim())
    .filter(
      (f) =>
        f.length >= 4 &&
        f.length <= 90 &&
        !leaksUnfinished(f, ctx.notCompletedTitles) &&
        !hasForbiddenContact(f) &&
        !inventsPolicy(f, allowed),
    )
    .slice(0, 3);
  return { reply, citedPolicyIds, followUps };
}
